import { randomUUID } from 'node:crypto';

import { nowIso } from '../validation/common.js';
import { hashToken } from './tokens.js';

const DEFAULT_REFRESH_TOKEN_TTL_HOURS = 720;
export const REFRESH_TOKEN_TTL_HOURS = Number(
  process.env.REFRESH_TOKEN_TTL_HOURS ||
    process.env.SESSION_TTL_HOURS ||
    DEFAULT_REFRESH_TOKEN_TTL_HOURS
);
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_HOURS * 60 * 60;
export const REFRESH_COOKIE_NAME =
  process.env.REFRESH_COOKIE_NAME || 'worktrack_refresh_token';

function normalizeSameSite(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none') return 'None';
  return 'Lax';
}

export function getRefreshCookieOptions() {
  const configuredSameSite = process.env.REFRESH_COOKIE_SAME_SITE;
  const sameSite = normalizeSameSite(
    configuredSameSite || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')
  );
  const secure =
    process.env.REFRESH_COOKIE_SECURE !== undefined
      ? process.env.REFRESH_COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    path: '/',
    sameSite,
    secure,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

export function buildSession(userId, rawToken, createdAt = nowIso()) {
  return {
    id: randomUUID(),
    userId,
    tokenHash: hashToken(rawToken),
    createdAt,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}
