import { requireManager } from '../../../auth/context.js';
import {
  buildSanitizedUser,
  createAuditLog,
  USER_WITH_SUBSCRIPTION_INCLUDE,
} from '../../../db/prisma-helpers.js';
import { findStoredPlan } from '../../../db/plans-store.js';
import { runStoreTransaction } from '../../../db/store.js';
import { readJsonBody, sendJson } from '../../../lib/http.js';
import {
  buildSubscriptionWriteData,
  resolveSubscriptionView,
} from '../../../services/prisma-views.js';
import { nowIso, shiftMonths } from '../../../validation/common.js';
import { resolveExtensionMonths } from '../../../validation/manager.js';

function isBeforeNow(isoDate, timestamp) {
  const parsed = new Date(isoDate);
  const now = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.getTime() < now.getTime();
}

function buildExtensionWindow(before, months) {
  const timestamp = nowIso();
  const shouldRestartWindow =
    before.status !== 'active' || isBeforeNow(before.currentPeriodEnd, timestamp);
  const extensionBaseEnd = shouldRestartWindow ? timestamp : before.currentPeriodEnd;

  return {
    currentPeriodStart: shouldRestartWindow ? timestamp : before.currentPeriodStart,
    currentPeriodEnd: shiftMonths(extensionBaseEnd, months),
  };
}

export async function handleManagerUserExtend(request, response, userId) {
  const context = await requireManager(request, response);
  if (!context) return;

  const parsedBody = await readJsonBody(request);
  const months = resolveExtensionMonths(parsedBody.months);

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

      const before = resolveSubscriptionView({
        user: target,
        subscription: target.subscription,
        plan: target.subscription?.plan,
        fallbackStartMode: target.subscription ? 'now' : 'month',
      });
      const nextWindow = buildExtensionWindow(before, months);
      const selectedPlan = target.subscription?.plan || (await findStoredPlan(tx, before.planId));

      if (!selectedPlan) {
        throw new Error('Invalid plan');
      }

      const subscriptionData = buildSubscriptionWriteData({
        plan: selectedPlan,
        before,
        payload: {
          ...before,
          status: 'active',
          source: 'manager',
          currentPeriodStart: nextWindow.currentPeriodStart,
          currentPeriodEnd: nextWindow.currentPeriodEnd,
          notes: before.notes,
          canceledAt: null,
        },
        actorUserId: context.user.id,
      });

      await tx.subscription.upsert({
        where: {
          userId: target.id,
        },
        update: {
          planId: subscriptionData.planId,
          status: subscriptionData.status,
          source: subscriptionData.source,
          currentPeriodStart: new Date(subscriptionData.currentPeriodStart),
          currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
          monthlyGenerationLimit: subscriptionData.monthlyGenerationLimit,
          quotaOverride: subscriptionData.quotaOverride,
          assignedByUserId: subscriptionData.assignedByUserId,
          assignedAt: new Date(subscriptionData.assignedAt),
          notes: subscriptionData.notes,
          canceledAt: null,
          pendingPlanId: subscriptionData.pendingPlanId,
          pendingRequestedAt: subscriptionData.pendingRequestedAt
            ? new Date(subscriptionData.pendingRequestedAt)
            : null,
          pendingSource: subscriptionData.pendingSource,
        },
        create: {
          id: target.id,
          userId: target.id,
          planId: subscriptionData.planId,
          status: subscriptionData.status,
          source: subscriptionData.source,
          currentPeriodStart: new Date(subscriptionData.currentPeriodStart),
          currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
          monthlyGenerationLimit: subscriptionData.monthlyGenerationLimit,
          quotaOverride: subscriptionData.quotaOverride,
          assignedByUserId: subscriptionData.assignedByUserId,
          assignedAt: new Date(subscriptionData.assignedAt),
          notes: subscriptionData.notes,
          canceledAt: null,
          pendingPlanId: subscriptionData.pendingPlanId,
          pendingRequestedAt: subscriptionData.pendingRequestedAt
            ? new Date(subscriptionData.pendingRequestedAt)
            : null,
          pendingSource: subscriptionData.pendingSource,
        },
      });

      const updatedUser = await tx.user.update({
        where: {
          id: target.id,
        },
        data: {
          updatedAt: new Date(nowIso()),
        },
        include: USER_WITH_SUBSCRIPTION_INCLUDE,
      });

      const userView = await buildSanitizedUser(tx, updatedUser);
      await createAuditLog(tx, {
        action: 'subscription.extended',
        actorUserId: context.user.id,
        targetUserId: updatedUser.id,
        entityType: 'subscription',
        entityId: updatedUser.id,
        before,
        after: userView.subscription,
        meta: { months },
      });

      return userView;
    },
  });

  sendJson(response, 200, { user });
}
