import {
  getCookie,
  sendError,
  sendJson,
} from '../../lib/http.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../auth/context.js';
import {
  createAccessToken,
  getAccessTokenExpiresAt,
  hashToken,
} from '../../auth/tokens.js';
import {
  buildSanitizedUser,
  createAuditLog,
} from '../../db/prisma-helpers.js';
import { runStoreTransaction } from '../../db/store.js';
import {
  buildRequestMeta,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from './shared.js';

export async function handleRefresh(request, response) {
  const refreshToken = getCookie(request, REFRESH_COOKIE_NAME);

  if (!refreshToken) {
    clearRefreshTokenCookie(response);
    return sendError(response, 401, 'Refresh token is required');
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

      const currentSession = await tx.session.findUnique({
        where: {
          tokenHash: hashToken(refreshToken),
        },
        include: {
          user: true,
        },
      });

      if (!currentSession?.user || currentSession.user.deletedAt) {
        if (currentSession) {
          await tx.session.deleteMany({
            where: {
              ...(currentSession.user?.deletedAt
                ? {
                    userId: currentSession.user.id,
                  }
                : {
                    id: currentSession.id,
                  }),
            },
          });
        }
        return null;
      }

      const issuedAt = Date.now();
      const nextSessionExpiresAt = new Date(
        issuedAt + REFRESH_TOKEN_TTL_SECONDS * 1000
      );

      await tx.session.update({
        where: {
          id: currentSession.id,
        },
        data: {
          expiresAt: nextSessionExpiresAt,
        },
      });

      await createAuditLog(tx, {
        action: 'auth.session.refreshed',
        actorUserId: currentSession.user.id,
        targetUserId: currentSession.user.id,
        entityType: 'session',
        entityId: currentSession.id,
        meta: buildRequestMeta(request, {
          sessionId: currentSession.id,
        }),
      });

      return {
        token: createAccessToken(
          {
            userId: currentSession.user.id,
            sessionId: currentSession.id,
          },
          issuedAt
        ),
        accessTokenExpiresAt: getAccessTokenExpiresAt(issuedAt),
        user: await buildSanitizedUser(tx, currentSession.user),
      };
    },
  });

  if (!payload) {
    clearRefreshTokenCookie(response);
    return sendError(response, 401, 'Invalid or expired refresh token');
  }

  setRefreshTokenCookie(response, refreshToken);
  sendJson(response, 200, {
    token: payload.token,
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    user: payload.user,
  });
}
