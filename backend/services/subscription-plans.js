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
