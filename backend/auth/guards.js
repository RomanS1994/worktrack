import { runStoreRead } from '../db/store.js';
import { getBearerToken, sendError } from '../lib/http.js';
import { verifyAccessToken } from './tokens.js';

export function hasManagerAccess(role) {
  return role === 'MANAGER';
}

export function getAccessTokenClaims(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function getAuthContext(request, response) {
  const rawAccessToken = getBearerToken(request);

  if (!rawAccessToken) {
    sendError(response, 401, 'Authorization token is required');
    return null;
  }

  const tokenClaims = verifyAccessToken(rawAccessToken);

  if (!tokenClaims) {
    sendError(response, 401, 'Invalid or expired access token');
    return null;
  }

  return runStoreRead({
    prisma: async client => {
      await client.session.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      const session = await client.session.findUnique({
        where: {
          id: tokenClaims.sessionId,
        },
        include: {
          user: true,
        },
      });

      if (!session || session.userId !== tokenClaims.userId) {
        sendError(response, 401, 'Invalid or expired session');
        return null;
      }

      if (!session.user) {
        sendError(response, 401, 'User not found for session');
        return null;
      }

      if (session.user.deletedAt) {
        await client.session.deleteMany({
          where: {
            userId: session.user.id,
          },
        });
        sendError(response, 401, 'Invalid or expired session');
        return null;
      }

      return {
        user: session.user,
        session,
        tokenClaims,
      };
    },
  });
}

export async function requireManager(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return null;

  if (!hasManagerAccess(context.user.role)) {
    sendError(response, 403, 'Manager access is required');
    return null;
  }

  return context;
}
