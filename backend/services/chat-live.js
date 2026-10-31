// Connections intentionally remain process-local. Multi-instance deployments
// require a shared pub/sub transport in addition to this bounded connection hub.
export function createChatLiveService({
  now = Date.now,
  setInterval: interval = setInterval,
  clearInterval: clearEvery = clearInterval,
  setTimeout: timeout = setTimeout,
  clearTimeout: clearAfter = clearTimeout,
  heartbeatMs = 15000,
  authorizeTimeoutMs = 5000,
  maxPerMember = 6,
  maxConnections = 1000,
  maxBufferedBytes = 256 * 1024,
} = {}) {
  const companies = new Map();
  let connectionCount = 0;

  function presence(companyId) {
    const streams = companies.get(companyId);
    const membershipIds = streams ? [...streams.keys()] : [];
    return { membershipIds, onlineCount: membershipIds.length };
  }

  function write(record, data) {
    if (record.closed) return false;
    const response = record.response;
    if (now() >= record.expiresAt || response.writableEnded || response.destroyed ||
        response.writableLength > maxBufferedBytes) {
      record.close(false);
      return false;
    }
    try {
      // Do not accumulate unbounded event queues for clients that cannot read.
      // Disconnecting is safe: clients reconcile history after reconnecting.
      if (response.write(data) === false) {
        record.close(false);
        return false;
      }
      return true;
    } catch {
      record.close(false);
      return false;
    }
  }

  function broadcast(companyId, event, payload) {
    const streams = companies.get(companyId);
    if (!streams?.size) return;
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    let removed = false;
    for (const records of [...streams.values()]) {
      for (const record of [...records]) removed = !write(record, data) || removed;
    }
    if (removed && event !== 'presence') broadcastPresence(companyId);
  }

  function broadcastPresence(companyId) {
    broadcast(companyId, 'presence', presence(companyId));
  }

  function subscribe(request, response, companyId, membershipId, options = {}) {
    if (!companyId || !membershipId || typeof options.authorize !== 'function')
      throw new Error('Company access is required');
    const expiresAt = new Date(options.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now())
      throw new Error('Invalid or expired access token');
    let streams = companies.get(companyId);
    let members = streams?.get(membershipId);
    if (connectionCount >= maxConnections || (members?.size || 0) >= maxPerMember)
      throw new Error('Too many chat connections');
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (!streams) companies.set(companyId, (streams = new Map()));
    if (!members) streams.set(membershipId, (members = new Set()));
    const record = { response, expiresAt, closed: false, close: null };
    let heartbeat, expiry, authorizationDeadline;
    let checking = false;

    function close(notify = true) {
      if (record.closed) return;
      record.closed = true;
      clearEvery(heartbeat);
      clearAfter(expiry);
      clearAfter(authorizationDeadline);
      request.off('close', onClose);
      response.off('close', onClose);
      response.off('error', onClose);
      members.delete(record);
      connectionCount -= 1;
      if (!members.size) streams.delete(membershipId);
      if (!streams.size) companies.delete(companyId);
      if (!response.writableEnded && !response.destroyed) {
        try { response.end(); } catch { response.destroy?.(); }
      }
      if (notify) broadcastPresence(companyId);
    }
    const onClose = () => close();
    record.close = close;
    members.add(record);
    connectionCount += 1;
    request.on('close', onClose);
    response.on('close', onClose);
    response.on('error', onClose);

    async function checkAccess() {
      if (record.closed || checking) return;
      checking = true;
      authorizationDeadline = timeout(() => close(), authorizeTimeoutMs);
      authorizationDeadline?.unref?.();
      try {
        const allowed = await options.authorize();
        if (record.closed) return;
        if (!allowed || now() >= expiresAt) close();
        else write(record, ': ping\n\n');
      } catch {
        // Database/network errors cannot keep a private stream open indefinitely.
        close();
      } finally {
        checking = false;
        clearAfter(authorizationDeadline);
      }
    }

    heartbeat = interval(() => void checkAccess(), heartbeatMs);
    heartbeat?.unref?.();
    expiry = timeout(() => close(), Math.min(expiresAt - now(), 2147483647));
    expiry?.unref?.();
    write(record, `event: ready\ndata: ${JSON.stringify({ ok: true, presence: presence(companyId) })}\n\n`);
    broadcastPresence(companyId);
    return close;
  }

  return { subscribe, broadcast, presence, connectionCount: () => connectionCount };
}

const live = createChatLiveService();
export const subscribeToCompanyChat = live.subscribe;
export const broadcastCompanyChat = live.broadcast;
export const getCompanyChatPresence = live.presence;
