const companyStreams = new Map();

function getCompanyMap(companyId) {
  if (!companyStreams.has(companyId)) companyStreams.set(companyId, new Map());
  return companyStreams.get(companyId);
}

function broadcastPresence(companyId) {
  const streams = companyStreams.get(companyId);
  if (!streams?.size) return;
  const payload = {
    membershipIds: [...streams.entries()].filter(([, responses]) => responses.size > 0).map(([membershipId]) => membershipId),
  };
  const data = `event: presence\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const responses of streams.values()) {
    for (const response of [...responses]) {
      if (response.writableEnded || response.destroyed) {
        responses.delete(response);
        continue;
      }
      try {
        response.write(data);
      } catch {
        responses.delete(response);
      }
    }
  }
}

export function getCompanyChatPresence(companyId) {
  const streams = companyStreams.get(companyId);
  const membershipIds = streams
    ? [...streams.entries()].filter(([, responses]) => responses.size > 0).map(([membershipId]) => membershipId)
    : [];
  return { membershipIds, onlineCount: membershipIds.length };
}

export function subscribeToCompanyChat(request, response, companyId, membershipId) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const streams = getCompanyMap(companyId);
  if (!streams.has(membershipId)) streams.set(membershipId, new Set());
  const memberStreams = streams.get(membershipId);
  memberStreams.add(response);

  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true, presence: getCompanyChatPresence(companyId) })}\n\n`);
  broadcastPresence(companyId);

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': ping\n\n');
  }, 20000);

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    memberStreams.delete(response);
    if (!memberStreams.size) streams.delete(membershipId);
    if (!streams.size) companyStreams.delete(companyId);
    else broadcastPresence(companyId);
  }

  request.on('close', cleanup);
  response.on('close', cleanup);
}

export function broadcastCompanyChat(companyId, event, payload) {
  const streams = companyStreams.get(companyId);
  if (!streams?.size) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [membershipId, responses] of [...streams.entries()]) {
    for (const response of [...responses]) {
      if (response.writableEnded || response.destroyed) {
        responses.delete(response);
        continue;
      }
      try {
        response.write(data);
      } catch {
        responses.delete(response);
      }
    }
    if (!responses.size) streams.delete(membershipId);
  }
  if (!streams.size) companyStreams.delete(companyId);
}
