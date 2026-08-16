import { requireAdmin } from '../../auth/context.js';
import {
  buildSanitizedUser,
  createAuditLog,
  USER_WITH_SUBSCRIPTION_INCLUDE,
} from '../../db/prisma-helpers.js';
import { runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { nowIso } from '../../validation/common.js';
import { validateRoleValue } from '../../validation/manager.js';

export async function handleManagerUserRole(request, response, userId) {
  const context = await requireAdmin(request, response);
  if (!context) return;

  const body = await readJsonBody(request);
  const nextRole = validateRoleValue(body.role);

  const user = await runStoreTransaction({
    prisma: async tx => {
      const target = await tx.user.findUnique({
        where: {
          id: userId,
        },
        include: USER_WITH_SUBSCRIPTION_INCLUDE,
      });

      if (!target) {
        throw new Error('User not found');
      }

      const beforeRole = target.role;

      if (beforeRole === 'admin' && nextRole !== 'admin') {
        const adminCount = await tx.user.count({
          where: {
            role: 'admin',
          },
        });
        if (adminCount <= 1) {
          throw new Error('At least one admin is required');
        }
      }

      const updatedUser = await tx.user.update({
        where: {
          id: target.id,
        },
        data: {
          role: nextRole,
          updatedAt: new Date(nowIso()),
        },
        include: USER_WITH_SUBSCRIPTION_INCLUDE,
      });

      await createAuditLog(tx, {
        action: 'user.role.updated',
        actorUserId: context.user.id,
        targetUserId: updatedUser.id,
        entityType: 'user',
        entityId: updatedUser.id,
        before: { role: beforeRole },
        after: { role: nextRole },
      });

      return buildSanitizedUser(tx, updatedUser);
    },
  });

  sendJson(response, 200, { user });
}
