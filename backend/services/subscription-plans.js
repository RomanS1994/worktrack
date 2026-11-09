export const SUBSCRIPTION_PLANS = {
  TEAM_1_5: { code: 'TEAM_1_5', name: 'Мала команда', min: 1, max: 5, price: 490 },
  TEAM_6_10: { code: 'TEAM_6_10', name: 'Команда', min: 6, max: 10, price: 790 },
  TEAM_11_20: { code: 'TEAM_11_20', name: 'Бригада', min: 11, max: 20, price: 1290 },
  TEAM_21_40: { code: 'TEAM_21_40', name: 'Компанія', min: 21, max: 40, price: 2190 },
};
export function getSubscriptionPlan(code) {
  const plan = SUBSCRIPTION_PLANS[String(code || '')];
  if (!plan) throw new Error('Unsupported subscription plan');
  return plan;
}
export const subscriptionPlanList = Object.values(SUBSCRIPTION_PLANS).map(plan => ({ code: plan.code, name: plan.name, employeeLimit: plan.max, minEmployees: plan.min, monthlyPriceCzk: plan.price }));


export async function lockCompanyForSeatChange(client, companyId) {
  if (client?.$queryRaw) {
    await client.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
  }
}

export async function applyScheduledCompanyPlan(client, companyId, now = new Date()) {
  const subscription = await client.companySubscription.findUnique({ where: { companyId } });
  if (!subscription?.scheduledEffectiveAt || subscription.scheduledEffectiveAt > now) return subscription;

  const periodStart = subscription.scheduledEffectiveAt;
  const periodEnd = subscription.scheduledPeriodEnd || periodStart;
  return client.companySubscription.update({
    where: { companyId },
    data: {
      planCode: subscription.scheduledPlanCode || subscription.planCode,
      employeeLimit: subscription.scheduledEmployeeLimit || subscription.employeeLimit,
      monthlyPriceCzk: subscription.scheduledMonthlyPriceCzk || subscription.monthlyPriceCzk,
      billingPeriod: subscription.scheduledBillingPeriod || subscription.billingPeriod || 'month',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      status: 'ACTIVE',
      gracePeriodEnd: new Date(periodEnd.getTime() + 5 * 86400000),
      scheduledPlanCode: null,
      scheduledEmployeeLimit: null,
      scheduledMonthlyPriceCzk: null,
      scheduledBillingPeriod: null,
      scheduledEffectiveAt: null,
      scheduledPeriodEnd: null,
    },
  });
}

export async function assertEmployeeSeatAvailable(client, companyId, now = new Date()) {
  await lockCompanyForSeatChange(client, companyId);
  const subscription = await applyScheduledCompanyPlan(client, companyId, now);
  if (!subscription) return;

  const inPaidPeriod = ['ACTIVE', 'TRIAL'].includes(subscription.status)
    && subscription.currentPeriodEnd > now;
  const inGracePeriod = subscription.gracePeriodEnd && subscription.gracePeriodEnd > now;
  if (!inPaidPeriod && !inGracePeriod) throw new Error('Subscription payment is required to add employees');

  const activeSeats = await client.companyMembership.count({
    where: { companyId, role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null },
  });
  const limit = subscription.scheduledEffectiveAt
    && subscription.scheduledEmployeeLimit < subscription.employeeLimit
    ? subscription.scheduledEmployeeLimit
    : subscription.employeeLimit;
  if (activeSeats >= limit) {
    throw new Error(`Subscription employee limit reached (${activeSeats}/${limit})`);
  }
}
