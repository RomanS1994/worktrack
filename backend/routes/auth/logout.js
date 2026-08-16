import { getAccessTokenClaims, REFRESH_COOKIE_NAME } from '../../auth/context.js';
import { hashToken } from '../../auth/tokens.js';
import { createAuditLog } from '../../db/prisma-helpers.js';
import { runStoreTransaction } from '../../db/store.js';
import { getCookie, sendJson } from '../../lib/http.js';
import { buildRequestMeta, clearRefreshTokenCookie } from './shared.js';

export async function handleLogout(request, response) {
  const refreshToken = getCookie(request, REFRESH_COOKIE_NAME);
  const accessTokenClaims = getAccessTokenClaims(request);

  await runStoreTransaction({
    prisma: async tx => {
      await tx.session.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      const revokedSessionIds = new Set();

      if (accessTokenClaims?.sessionId) {
        revokedSessionIds.add(accessTokenClaims.sessionId);
      }

      if (refreshToken) {
        const refreshSession = await tx.session.findUnique({
          where: {
            tokenHash: hashToken(refreshToken),
          },
        });

        if (refreshSession) {
          revokedSessionIds.add(refreshSession.id);
        }
      }

      if (revokedSessionIds.size === 0) {
        return;
      }

      const revokedIds = Array.from(revokedSessionIds);
      const revokedSessions = await tx.session.findMany({
        where: {
          id: {
            in: revokedIds,
          },
        },
      });

      await tx.session.deleteMany({
        where: {
          id: {
            in: revokedIds,
          },
        },
      });

      const targetSession = revokedSessions[0] || null;
      await createAuditLog(tx, {
        action: 'auth.logout',
        actorUserId: targetSession?.userId || accessTokenClaims?.userId || null,
        targetUserId: targetSession?.userId || accessTokenClaims?.userId || null,
        entityType: 'session',
        entityId: targetSession?.id || accessTokenClaims?.sessionId || null,
        meta: buildRequestMeta(request, {
          revokedSessions: revokedIds,
        }),
      });
    },
  });

  clearRefreshTokenCookie(response);
  sendJson(response, 200, { ok: true });
}
