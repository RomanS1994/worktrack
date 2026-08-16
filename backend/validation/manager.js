import { ROLE_VALUES, normalizeInteger, normalizeText } from './common.js';

export function validateRoleValue(value) {
  const nextRole = normalizeText(value).toUpperCase();

  if (!ROLE_VALUES.includes(nextRole)) {
    throw new Error('Invalid role');
  }

  return nextRole;
}

export function validatePlanCreateInput(body = {}) {
  const limit = normalizeInteger(body.monthlyGenerationLimit, 0);
  const name = normalizeText(body.name);

  if (!name) {
    throw new Error('Plan name is required');
  }

  if (limit <= 0) {
    throw new Error('Plan limit must be greater than 0');
  }

  return {
    limit,
    name,
  };
}

export function resolveExtensionMonths(value) {
  return Math.min(12, Math.max(1, normalizeInteger(value, 1)));
}
