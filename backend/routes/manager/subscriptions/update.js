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
import { nowIso } from '../../../validation/common.js';
import { resolveNextMonthlyGenerationLimit } from './shared.js';

function toDateOrNull(value) {
  return value ? new Date(value) : null;
}

function buildSubscriptionPersistenceData(subscriptionData) {
  return {
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
    canceledAt: toDateOrNull(subscriptionData.canceledAt),
    pendingPlanId: subscriptionData.pendingPlanId,
    pendingRequestedAt: toDateOrNull(subscriptionData.pendingRequestedAt),
    pendingSource: subscriptionData.pendingSource,
  };
}

export async function handleManagerUserSubscription(request, response, userId) {
  const context = await requireManager(request, response);
  if (!context) return;

  const body = await readJsonBody(request);

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
      const nextPlanId = body.planId || before.planId;
      const selectedPlan = await findStoredPlan(tx, nextPlanId);

      if (!selectedPlan) {
        throw new Error('Invalid plan');
      }

      const subscriptionData = buildSubscriptionWriteData({
        plan: selectedPlan,
        before,
        payload: {
          ...before,
          ...body,
          source: 'manager',
          monthlyGenerationLimit: resolveNextMonthlyGenerationLimit(
            body,
            before,
            nextPlanId,
            selectedPlan.monthlyGenerationLimit
          ),
        },
        actorUserId: context.user.id,
      });
      const subscriptionRecord = buildSubscriptionPersistenceData(subscriptionData);

      await tx.subscription.upsert({
        where: {
          userId: target.id,
        },
        update: subscriptionRecord,
        create: {
          id: target.id,
          userId: target.id,
          ...subscriptionRecord,
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
        action: 'subscription.updated',
        actorUserId: context.user.id,
        targetUserId: updatedUser.id,
        entityType: 'subscription',
        entityId: updatedUser.id,
        before,
        after: userView.subscription,
        meta: {
          planId: userView.planId,
        },
      });

      return userView;
    },
  });

  sendJson(response, 200, { user });
}
