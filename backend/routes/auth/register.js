import {
  getRateLimitState,
  recordRateLimitFailure,
  resetRateLimit,
} from '../../auth/rate-limit.js';
import { runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { normalizeEmail } from '../../validation/common.js';
import { registerCompanyAccount } from '../../services/company-registration.js';
import {
  buildRateLimitIdentifier,
  buildRequestMeta,
  issueAuthSession,
  logAuthFailure,
  sendRateLimitExceeded,
  setRefreshTokenCookie,
} from './shared.js';

export async function handleRegister(request, response) {
  const body = await readJsonBody(request);
  const attemptedEmail = normalizeEmail(body.email);
  const identifier = buildRateLimitIdentifier(request, attemptedEmail);
  const rateLimit = getRateLimitState('register', identifier);

  if (!rateLimit.allowed) {
    return sendRateLimitExceeded(response, 'register', rateLimit.retryAfterSeconds);
  }

  try {
    const payload = await runStoreTransaction({
      prisma: tx =>
        registerCompanyAccount(tx, body, {
          issueAuthSession,
          requestMeta: buildRequestMeta(request, {
            email: attemptedEmail,
          }),
        }),
    });

    resetRateLimit('register', identifier);
    setRefreshTokenCookie(response, payload.refreshToken);
    sendJson(response, 201, {
      token: payload.token,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      user: payload.user,
    });
  } catch (error) {
    recordRateLimitFailure('register', identifier);
    await logAuthFailure(
      request,
      'auth.register.failed',
      attemptedEmail,
      null,
      error instanceof Error ? error.message : 'Registration failed'
    );
    throw error;
  }
}
