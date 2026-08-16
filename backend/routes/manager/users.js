import { requireManager } from '../../auth/context.js';
import { Prisma } from '@prisma/client';
import {
  buildManagerUserSummaries,
  buildSanitizedUser,
  ORDER_LIST_SELECT,
  sanitizeAuditLogs,
  sanitizeOrderListRecord,
} from '../../db/prisma-helpers.js';
import { prisma } from '../../db/prisma.js';
import { sendJson } from '../../lib/http.js';
import { hasFlightStatusAccess } from '../../services/flight-status.js';
import { normalizeText } from '../../validation/common.js';

const MANAGER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  deletedAt: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  subscription: {
    select: {
      planId: true,
      status: true,
      source: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      monthlyGenerationLimit: true,
      quotaOverride: true,
      assignedByUserId: true,
      assignedAt: true,
      notes: true,
      canceledAt: true,
      pendingPlanId: true,
      pendingRequestedAt: true,
      pendingSource: true,
      plan: true,
    },
  },
};

function getOrderSanitizeOptions(user) {
  return {
    includeFlightStatus: hasFlightStatusAccess(user),
  };
}

async function loadAvatarUrls(prismaClient, userIds) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];

  if (!ids.length) {
    return new Map();
  }

  const rows = await prismaClient.$queryRaw`
    SELECT
      id,
      CASE
        WHEN char_length(COALESCE(profile->>'avatarUrl', '')) <= 120000
          THEN COALESCE(profile->>'avatarUrl', '')
        ELSE ''
      END AS "avatarUrl"
    FROM users
    WHERE id IN (${Prisma.join(ids)})
  `;

  return new Map(
    rows.map(row => [row.id, typeof row.avatarUrl === 'string' ? row.avatarUrl : ''])
  );
}

export async function handleManagerUserList(request, response, url) {
  const context = await requireManager(request, response);
  if (!context) return;

  const search = normalizeText(url.searchParams.get('search')).toLowerCase();
  const status = normalizeText(url.searchParams.get('status')).toLowerCase();
  const role = normalizeText(url.searchParams.get('role')).toLowerCase();
  const planId = normalizeText(url.searchParams.get('planId'));

  const where = {
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
    ...(!role || role === 'all' ? {} : { role }),
    ...(!planId || planId === 'all'
      ? {}
      : {
          subscription: {
            is: {
              planId,
            },
          },
        }),
  };

  const rawUsers = await prisma.user.findMany({
    where,
    select: MANAGER_USER_SELECT,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  let users = await buildManagerUserSummaries(prisma, rawUsers);
  const avatarUrls = await loadAvatarUrls(
    prisma,
    users.map(user => user.id)
  );

  users = users.map(user => {
    const avatarUrl = avatarUrls.get(user.id) || '';

    return {
      ...user,
      avatarUrl,
      profile: {
        ...(user.profile || {}),
        avatarUrl,
      },
    };
  });

  if (status && status !== 'all') {
    users = users.filter(user =>
      status === 'pending'
        ? Boolean(user.subscription.pendingPlanId) || user.subscription.status === 'pending'
        : user.subscription.status === status
    );
  }

  sendJson(response, 200, { users });
}

export async function handleManagerUserDetail(request, response, userId) {
  const context = await requireManager(request, response);
  if (!context) return;

  const target = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: MANAGER_USER_SELECT,
  });

  if (!target) {
    throw new Error('User not found');
  }

  const [summary, recentOrders, auditRecords] = await Promise.all([
    buildManagerUserSummaries(prisma, [target]),
    prisma.order.findMany({
      where: {
        userId: target.id,
      },
      select: ORDER_LIST_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          {
            targetUserId: target.id,
          },
          {
            actorUserId: target.id,
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    }),
  ]);

  sendJson(response, 200, {
    user: summary[0] || (await buildSanitizedUser(prisma, target)),
    recentOrders: recentOrders.map(order => sanitizeOrderListRecord(order, getOrderSanitizeOptions(context.user))),
    audit: await sanitizeAuditLogs(prisma, auditRecords),
  });
}
