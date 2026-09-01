import { runStoreRead } from '../db/store.js';
import { getBearerToken, sendError } from '../lib/http.js';
import { normalizeText } from '../validation/common.js';
import { verifyAccessToken } from './tokens.js';

export function hasManagerAccess(value) {
  const role =
    typeof value === 'string'
      ? value
      : value?.activeMembership?.role || value?.role || value?.membership?.role || '';

  return role === 'MANAGER';
}

export function hasEmployeeAccess(value) {
  const role =
    typeof value === 'string'
      ? value
      : value?.activeMembership?.role || value?.role || value?.membership?.role || '';

  return role === 'EMPLOYEE';
}

export function getAccessTokenClaims(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyAccessToken(token);
}

function getRequestedCompanyId(request) {
  const rawHeader = request.headers['x-company-id'];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  return normalizeText(headerValue);
}

async function loadMembershipContext(client, userId, requestedCompanyId = '') {
  const memberships = await client.companyMembership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: {
      company: true,
    },
    orderBy: [
      {
        createdAt: 'asc',
      },
    ],
  });

  if (requestedCompanyId) {
    const requestedMembership = memberships.find(
      membership => membership.companyId === requestedCompanyId
    );

    return {
      memberships,
      activeMembership: requestedMembership || null,
      activeCompany: requestedMembership?.company || null,
      requestedCompanyId,
    };
  }

  const activeMembership = memberships[0] || null;

  return {
    memberships,
    activeMembership,
    activeCompany: activeMembership?.company || null,
    requestedCompanyId: '',
  };
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
      const session = await client.session.findUnique({
        where: {
          id: tokenClaims.sessionId,
        },
        include: {
          user: true,
        },
      });

      if (
        !session ||
        session.userId !== tokenClaims.userId ||
        !session.expiresAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
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

      const membershipContext = await loadMembershipContext(
        client,
        session.user.id,
        getRequestedCompanyId(request)
      );

      if (membershipContext.requestedCompanyId && !membershipContext.activeMembership) {
        sendError(response, 403, 'Company access is required');
        return null;
      }

      return {
        user: session.user,
        session,
        tokenClaims,
        memberships: membershipContext.memberships,
        activeMembership: membershipContext.activeMembership,
        activeCompany: membershipContext.activeCompany,
      };
    },
  });
}

export async function requireManager(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return null;

  if (!hasManagerAccess(context)) {
    sendError(response, 403, 'Manager access is required');
    return null;
  }

  return context;
}

export async function requireEmployee(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return null;

  if (!hasEmployeeAccess(context)) {
    sendError(response, 403, 'Employee access is required');
    return null;
  }

  return context;
}
