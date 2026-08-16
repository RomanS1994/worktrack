import { verifyPassword } from '../../auth/tokens.js';
import {
  getRateLimitState,
  recordRateLimitFailure,
  resetRateLimit,
} from '../../auth/rate-limit.js';
import {
  buildSanitizedUser,
  createAuditLog,
} from '../../db/prisma-helpers.js';
import { runStoreRead, runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendError, sendJson } from '../../lib/http.js';
import { validateLoginInput } from '../../validation/auth.js';
import { normalizeEmail } from '../../validation/common.js';
import {
  buildRateLimitIdentifier,
  buildRequestMeta,
  issueAuthSession,
  logAuthFailure,
  sendRateLimitExceeded,
  setRefreshTokenCookie,
} from './shared.js';

export async function handleLogin(request, response) {
  const body = await readJsonBody(request);
  const attemptedEmail = normalizeEmail(body.email);
  const identifier = buildRateLimitIdentifier(request, attemptedEmail);
  const rateLimit = getRateLimitState('login', identifier);

  if (!rateLimit.allowed) {
    return sendRateLimitExceeded(response, 'login', rateLimit.retryAfterSeconds);
  }

  const { email, password } = validateLoginInput(body);
  const user = await runStoreRead({
    prisma: client =>
      client.user.findUnique({
        where: {
          email,
        },
      }),
  });

  if (!user || user.deletedAt || !verifyPassword(password, user.passwordHash)) {
    recordRateLimitFailure('login', identifier);
    await logAuthFailure(
      request,
      'auth.login.failed',
      email,
      user?.id || null,
      'Invalid email or password'
    );
    return sendError(response, 401, 'Invalid email or password');
  }

  const payload = await runStoreTransaction({
    prisma: async tx => {
      await tx.session.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      const freshUser = await tx.user.findUnique({
        where: {
          id: user.id,
        },
      });

      if (!freshUser) {
        throw new Error('User not found');
      }

      const authSession = issueAuthSession(freshUser.id);
      await tx.session.create({
        data: {
          id: authSession.session.id,
          userId: freshUser.id,
          tokenHash: authSession.session.tokenHash,
          createdAt: new Date(authSession.session.createdAt),
          expiresAt: new Date(authSession.session.expiresAt),
        },
      });
      await createAuditLog(tx, {
        action: 'auth.login.succeeded',
        actorUserId: freshUser.id,
        targetUserId: freshUser.id,
        entityType: 'session',
        entityId: authSession.session.id,
        meta: buildRequestMeta(request, {
          email: freshUser.email,
        }),
      });

      return {
        refreshToken: authSession.refreshToken,
        token: authSession.accessToken,
        accessTokenExpiresAt: authSession.accessTokenExpiresAt,
        user: await buildSanitizedUser(tx, freshUser),
      };
    },
  });

  resetRateLimit('login', identifier);
  setRefreshTokenCookie(response, payload.refreshToken);
  sendJson(response, 200, {
    token: payload.token,
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    user: payload.user,
  });
}
