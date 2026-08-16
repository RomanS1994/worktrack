import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  getAccessTokenTtlMinutes,
  getAuthTokenSecret,
} from '../config/runtime-env.js';

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;
const REFRESH_TOKEN_BYTES = 48;

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signTokenPayload(payload) {
  return createHmac('sha256', getAuthTokenSecret()).update(payload).digest('base64url');
}

export function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString(
    'hex'
  );

  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;

  const [salt, hash] = storedHash.split(':');
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString(
    'hex'
  );

  const source = Buffer.from(hash, 'hex');
  const target = Buffer.from(derivedKey, 'hex');

  if (source.length !== target.length) return false;

  return timingSafeEqual(source, target);
}

export function createRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function getAccessTokenExpiresAt(issuedAt = Date.now()) {
  const accessTokenTtlMinutes = getAccessTokenTtlMinutes();
  return new Date(
    issuedAt + accessTokenTtlMinutes * 60 * 1000
  ).toISOString();
}

export function createAccessToken({ userId, sessionId }, issuedAt = Date.now()) {
  const accessTokenTtlMinutes = getAccessTokenTtlMinutes();
  const payload = {
    typ: 'access',
    sub: userId,
    sid: sessionId,
    exp: Math.floor(
      (issuedAt + accessTokenTtlMinutes * 60 * 1000) / 1000
    ),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token) {
  if (!token || !token.includes('.')) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  const source = Buffer.from(signature);
  const target = Buffer.from(expectedSignature);

  if (source.length !== target.length) return null;
  if (!timingSafeEqual(source, target)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    if (payload.typ !== 'access' || !payload.sub || !payload.sid || !payload.exp) {
      return null;
    }

    if (payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
