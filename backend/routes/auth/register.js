import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../auth/tokens.js';
import {
  getRateLimitState,
  recordRateLimitFailure,
  resetRateLimit,
} from '../../auth/rate-limit.js';
import { buildSanitizedUser, createAuditLog } from '../../db/prisma-helpers.js';
import { runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { validateRegistrationInput } from '../../validation/auth.js';
import { normalizeEmail } from '../../validation/common.js';
import {
  buildRateLimitIdentifier,
  buildRequestMeta,
  issueAuthSession,
  logAuthFailure,
  sendRateLimitExceeded,
  setRefreshTokenCookie,
} from './shared.js';

function splitDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || '';

  return {
    firstName,
    lastName: parts.join(' '),
  };
}

function normalizeRegistrationProfile(profile) {
  return profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
}

export async function handleRegister(request, response) {
  const body = await readJsonBody(request);
  const attemptedEmail = normalizeEmail(body.email);
  const identifier = buildRateLimitIdentifier(request, attemptedEmail);
  const rateLimit = getRateLimitState('register', identifier);

  if (!rateLimit.allowed) {
    return sendRateLimitExceeded(response, 'register', rateLimit.retryAfterSeconds);
  }

  try {
    const { email, name, password } = validateRegistrationInput(body);

    const payload = await runStoreTransaction({
      prisma: async tx => {
        const existingUser = await tx.user.findUnique({
          where: {
            email,
          },
        });

        if (existingUser) {
          throw new Error('User with this email already exists');
        }

        const userId = randomUUID();
        const authSession = issueAuthSession(userId);
        const profile = normalizeRegistrationProfile(body.profile);
        const nameParts = splitDisplayName(name);

        const createdUser = await tx.user.create({
          data: {
            id: userId,
            name,
            email,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            passwordHash: hashPassword(password),
            role: 'EMPLOYEE',
            profile,
            sessions: {
              create: {
                id: authSession.session.id,
                tokenHash: authSession.session.tokenHash,
                createdAt: new Date(authSession.session.createdAt),
                expiresAt: new Date(authSession.session.expiresAt),
              },
            },
          },
        });

        await createAuditLog(tx, {
          action: 'user.registered',
          actorUserId: createdUser.id,
          targetUserId: createdUser.id,
          entityType: 'user',
          entityId: createdUser.id,
          after: {
            role: createdUser.role,
          },
          meta: buildRequestMeta(request, {
            email: createdUser.email,
            sessionId: authSession.session.id,
          }),
        });

        return {
          refreshToken: authSession.refreshToken,
          token: authSession.accessToken,
          accessTokenExpiresAt: authSession.accessTokenExpiresAt,
          user: await buildSanitizedUser(tx, createdUser),
        };
      },
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
