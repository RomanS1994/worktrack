const companyStreams = new Map();

function getSet(companyId) {
  if (!companyStreams.has(companyId)) companyStreams.set(companyId, new Set());
  return companyStreams.get(companyId);
}

export function subscribeToCompanyChat(request, response, companyId) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const streams = getSet(companyId);
  streams.add(response);
  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': ping\n\n');
  }, 20000);

  function cleanup() {
    clearInterval(heartbeat);
    streams.delete(response);
    if (!streams.size) companyStreams.delete(companyId);
  }

  request.on('close', cleanup);
  response.on('close', cleanup);
}

export function broadcastCompanyChat(companyId, event, payload) {
  const streams = companyStreams.get(companyId);
  if (!streams?.size) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of [...streams]) {
    if (response.writableEnded || response.destroyed) {
      streams.delete(response);
      continue;
    }
    try {
      response.write(data);
    } catch {
      streams.delete(response);
    }
  }
}
