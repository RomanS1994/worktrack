export function resolveNextMonthlyGenerationLimit(
  body,
  before,
  nextPlanId,
  nextPlanMonthlyGenerationLimit
) {
  if (
    body.monthlyGenerationLimit !== undefined &&
    body.monthlyGenerationLimit !== null &&
    body.monthlyGenerationLimit !== ''
  ) {
    return body.monthlyGenerationLimit;
  }

  if (nextPlanId === before.planId) {
    return before.monthlyGenerationLimit;
  }

  return nextPlanMonthlyGenerationLimit;
}
