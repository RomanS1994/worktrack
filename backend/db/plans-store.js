import { PLANS as DEFAULT_PLANS } from '../config/plans.js';
import { normalizePlanView } from '../services/prisma-views.js';
import { nowIso } from '../validation/common.js';
import { serializePlanRecord } from './mappers.js';

const PLAN_ORDER_BY = [
  {
    monthlyGenerationLimit: 'asc',
  },
  {
    name: 'asc',
  },
];

export async function ensureDefaultPlans(client) {
  const timestamp = nowIso();

  await Promise.all(
    DEFAULT_PLANS.map(plan =>
      client.plan.upsert({
        where: {
          id: plan.id,
        },
        create: serializePlanRecord({
          ...plan,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
        update: {
          name: plan.name,
          monthlyGenerationLimit: plan.monthlyGenerationLimit,
          description: plan.description,
          updatedAt: timestamp,
        },
      })
    )
  );
}

export async function findStoredPlan(
  client,
  planId,
  { includeInactive = true } = {}
) {
  if (includeInactive) {
    return client.plan.findUnique({
      where: {
        id: planId,
      },
    });
  }

  return client.plan.findFirst({
    where: {
      id: planId,
      isActive: true,
    },
  });
}

export async function listStoredPlans(
  client,
  { includeInactive = true } = {}
) {
  const plans = await client.plan.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: PLAN_ORDER_BY,
  });

  return plans.map(normalizePlanView);
}
