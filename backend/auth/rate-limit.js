const LOGIN_WINDOW_MS = Number(process.env.AUTH_LOGIN_WINDOW_MINUTES || 15) * 60 * 1000;
const LOGIN_LOCK_MS = Number(process.env.AUTH_LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const LOGIN_LOCK_AFTER = Number(process.env.AUTH_LOGIN_LOCK_AFTER_ATTEMPTS || 5);

const REGISTER_WINDOW_MS =
  Number(process.env.AUTH_REGISTER_WINDOW_MINUTES || 30) * 60 * 1000;
const REGISTER_LOCK_MS =
  Number(process.env.AUTH_REGISTER_LOCK_MINUTES || 30) * 60 * 1000;
const REGISTER_LOCK_AFTER = Number(process.env.AUTH_REGISTER_LOCK_AFTER_ATTEMPTS || 4);

const buckets = new Map();

function getConfig(action) {
  if (action === 'register') {
    return {
      windowMs: REGISTER_WINDOW_MS,
      lockMs: REGISTER_LOCK_MS,
      lockAfter: REGISTER_LOCK_AFTER,
    };
  }

  return {
    windowMs: LOGIN_WINDOW_MS,
    lockMs: LOGIN_LOCK_MS,
    lockAfter: LOGIN_LOCK_AFTER,
  };
}

function buildKeys(action, { ipAddress = '', email = '' } = {}) {
  const keys = [];
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (ipAddress) {
    keys.push(`${action}:ip:${ipAddress}`);
  }

  if (ipAddress && normalizedEmail) {
    keys.push(`${action}:identity:${ipAddress}:${normalizedEmail}`);
  }

  if (normalizedEmail) {
    keys.push(`${action}:email:${normalizedEmail}`);
  }

  return keys;
}

function getBucket(key) {
  const current = buckets.get(key);
  if (current) return current;

  const next = {
    attempts: [],
    lockUntil: 0,
  };
  buckets.set(key, next);
  return next;
}

function pruneBucket(bucket, windowMs) {
  const now = Date.now();
  bucket.attempts = bucket.attempts.filter(timestamp => now - timestamp < windowMs);
  if (bucket.lockUntil <= now) {
    bucket.lockUntil = 0;
  }
}

export function getRateLimitState(action, identifier) {
  const config = getConfig(action);
  const now = Date.now();
  let retryAfterMs = 0;

  for (const key of buildKeys(action, identifier)) {
    const bucket = getBucket(key);
    pruneBucket(bucket, config.windowMs);

    if (bucket.lockUntil > now) {
      retryAfterMs = Math.max(retryAfterMs, bucket.lockUntil - now);
    }
  }

  if (retryAfterMs > 0) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordRateLimitFailure(action, identifier) {
  const config = getConfig(action);
  const now = Date.now();

  for (const key of buildKeys(action, identifier)) {
    const bucket = getBucket(key);
    pruneBucket(bucket, config.windowMs);
    bucket.attempts.push(now);

    if (bucket.attempts.length >= config.lockAfter) {
      bucket.lockUntil = now + config.lockMs;
    }
  }
}

export function resetRateLimit(action, identifier) {
  for (const key of buildKeys(action, identifier)) {
    buckets.delete(key);
  }
}
