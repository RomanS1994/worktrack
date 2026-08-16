import {
  buildSession,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from '../../auth/context.js';
import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenExpiresAt,
} from '../../auth/tokens.js';
import { createAuditLog } from '../../db/prisma-helpers.js';
import { runStoreTransaction } from '../../db/store.js';
import {
  clearCookie,
  getClientIp,
  sendJson,
  setCookie,
} from '../../lib/http.js';

export function buildRequestMeta(request, extra = {}) {
  return {
    ipAddress: getClientIp(request),
    userAgent: String(request.headers['user-agent'] || ''),
    ...extra,
  };
}

export function buildRateLimitIdentifier(request, email = '') {
  return {
    ipAddress: getClientIp(request),
    email,
  };
}

export function issueAuthSession(userId, issuedAt = Date.now()) {
  const refreshToken = createRefreshToken();
  const createdAt = new Date(issuedAt).toISOString();
  const session = buildSession(userId, refreshToken, createdAt);

  return {
    refreshToken,
    session,
    accessToken: createAccessToken(
      {
        userId,
        sessionId: session.id,
      },
      issuedAt
    ),
    accessTokenExpiresAt: getAccessTokenExpiresAt(issuedAt),
  };
}

export function setRefreshTokenCookie(response, refreshToken) {
  setCookie(response, REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

export function clearRefreshTokenCookie(response) {
  clearCookie(response, REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

export function sendRateLimitExceeded(response, action, retryAfterSeconds) {
  response.setHeader('Retry-After', String(retryAfterSeconds));
  sendJson(response, 429, {
    error:
      action === 'register'
        ? 'Too many failed registration attempts. Try again later.'
        : 'Too many failed login attempts. Try again later.',
    retryAfterSeconds,
  });
}

export async function logAuthFailure(request, action, email, userId, reason) {
  await runStoreTransaction({
    prisma: async tx => {
      await createAuditLog(tx, {
        action,
        actorUserId: userId || null,
        targetUserId: userId || null,
        entityType: 'auth',
        entityId: email || null,
        meta: buildRequestMeta(request, {
          email: email || null,
          reason,
        }),
      });
    },
  });
}
