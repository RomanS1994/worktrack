const REQUEST_CONTEXT = Symbol('requestContext');

const ERROR_CODE_BY_MESSAGE = new Map([
  ['Company access is required', 'COMPANY_ACCESS_REQUIRED'],
  ['Manager access is required', 'MANAGER_ACCESS_REQUIRED'],
  ['Employee access is required', 'EMPLOYEE_ACCESS_REQUIRED'],
  ['Authorization token is required', 'AUTH_TOKEN_REQUIRED'],
  ['Invalid or expired access token', 'ACCESS_TOKEN_INVALID'],
  ['Invalid or expired session', 'SESSION_INVALID'],
  ['User not found for session', 'SESSION_USER_NOT_FOUND'],
  ['Invalid API key', 'API_KEY_INVALID'],
]);

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeOrigin(value) {
  const parsed = parseOrigin(String(value || '').trim());
  return parsed?.origin || '';
}

function isLocalhostOrigin(value) {
  const parsed = parseOrigin(value);
  if (!parsed) return false;

  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
}

function resolveAllowedOrigin(requestOrigin, configuredOrigin) {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  const configuredOrigins = String(configuredOrigin || '')
    .split(',')
    .map(item => normalizeOrigin(item))
    .filter(Boolean);

  if (!normalizedRequestOrigin) {
    return configuredOrigins[0] || '*';
  }

  if (configuredOrigins.length === 0) {
    return normalizedRequestOrigin;
  }

  if (configuredOrigins.includes(normalizedRequestOrigin)) {
    return normalizedRequestOrigin;
  }

  if (configuredOrigins.length === 1) {
    const allowedOrigin = configuredOrigins[0];
    const allowedParsed = parseOrigin(allowedOrigin);
    const requestParsed = parseOrigin(normalizedRequestOrigin);

    if (allowedParsed && requestParsed && allowedParsed.hostname === requestParsed.hostname) {
      if (isLocalhostOrigin(allowedOrigin) && isLocalhostOrigin(normalizedRequestOrigin)) {
        return normalizedRequestOrigin;
      }
    }
  }

  return configuredOrigins[0] || normalizedRequestOrigin;
}

function appendVaryHeader(response, value) {
  const current = response.getHeader('Vary');
  const values = new Set(
    String(current || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );

  values.add(value);
  response.setHeader('Vary', Array.from(values).join(', '));
}

function getBoundRequest(response) {
  return response[REQUEST_CONTEXT] || null;
}

export function bindRequestContext(response, request) {
  response[REQUEST_CONTEXT] = request;
}

export function setCorsHeaders(response) {
  const request = getBoundRequest(response);
  const configuredOrigin = process.env.CLIENT_ORIGIN || '';
  const requestOrigin = request?.headers.origin || '';
  const origin = resolveAllowedOrigin(requestOrigin, configuredOrigin);

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-KEY'
  );
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Request-ID');

  if (origin !== '*') {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    appendVaryHeader(response, 'Origin');
    return;
  }

  response.setHeader('Access-Control-Allow-Credentials', 'false');
}

export function handleCors(request, response) {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return true;
  }

  return false;
}

export function sendJson(response, statusCode, payload) {
  setCorsHeaders(response);
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

export function sendPdf(response, statusCode, buffer, fileName) {
  sendBuffer(response, statusCode, buffer, {
    contentType: 'application/pdf',
    fileName,
  });
}

export function sendBuffer(
  response,
  statusCode,
  buffer,
  { contentType = 'application/octet-stream', fileName = 'download' } = {}) {
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename=\"${fileName}\"`,
    'Content-Length': buffer.length,
  });
  response.end(buffer);
}

export function getErrorCode(message) {
  return ERROR_CODE_BY_MESSAGE.get(String(message || '')) || '';
}

export function sendError(response, statusCode, message, details = null) {
  const errorCode = getErrorCode(message);
  sendJson(response, statusCode, {
    error: message,
    ...(errorCode ? { errorCode } : {}),
    details,
  });
}

export async function readJsonBody(request) {
  const chunks = [];
  let totalLength = 0;
  const maxBytes = 5 * 1024 * 1024;

  for await (const chunk of request) {
    totalLength += chunk.length;

    if (totalLength > maxBytes) {
      throw new Error('Request body is too large');
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Invalid JSON body');
  }
}
