const REQUEST_CONTEXT = Symbol('requestContext');

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalhostOrigin(value) {
  const parsed = parseOrigin(value);
  if (!parsed) return false;

  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
}

function resolveAllowedOrigin(requestOrigin, configuredOrigin) {
  if (!requestOrigin) {
    return configuredOrigin || '*';
  }

  if (!configuredOrigin) {
    return requestOrigin;
  }

  const configuredOrigins = configuredOrigin
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (configuredOrigins.length === 1) {
    const allowedOrigin = configuredOrigins[0];
    const allowedParsed = parseOrigin(allowedOrigin);
    const requestParsed = parseOrigin(requestOrigin);

    if (allowedParsed && requestParsed && allowedParsed.hostname === requestParsed.hostname) {
      if (isLocalhostOrigin(allowedOrigin) && isLocalhostOrigin(requestOrigin)) {
        return requestOrigin;
      }
    }
  }

  return configuredOrigins[0] || requestOrigin;
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
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

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
  { contentType = 'application/octet-stream', fileName = 'download' } = {}
) {
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': buffer.length,
  });
  response.end(buffer);
}

export function sendError(response, statusCode, message, details = null) {
  sendJson(response, statusCode, {
    error: message,
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

  const raw = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function getBearerToken(request) {
  const authHeader = request.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export function parseCookies(request) {
  const header = request.headers.cookie || '';
  if (!header) return {};

  return header
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex < 0) return cookies;

      const name = pair.slice(0, separatorIndex).trim();
      const rawValue = pair.slice(separatorIndex + 1).trim();
      cookies[name] = decodeURIComponent(rawValue);
      return cookies;
    }, {});
}

export function getCookie(request, name) {
  return parseCookies(request)[name] || '';
}

function appendSetCookieHeader(response, value) {
  const current = response.getHeader('Set-Cookie');
  if (!current) {
    response.setHeader('Set-Cookie', value);
    return;
  }

  const next = Array.isArray(current) ? [...current, value] : [current, value];
  response.setHeader('Set-Cookie', next);
}

export function setCookie(response, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined && options.maxAge !== null) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  appendSetCookieHeader(response, parts.join('; '));
}

export function clearCookie(response, name, options = {}) {
  setCookie(response, name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getClientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (forwarded.length > 0) {
    return forwarded[0];
  }

  return request.socket?.remoteAddress || '';
}
