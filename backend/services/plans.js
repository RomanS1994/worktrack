import { randomUUID } from 'node:crypto';

import { PLANS as DEFAULT_PLANS } from '../config/plans.js';
import {
  nowIso,
  normalizeInteger,
  normalizeText,
} from '../validation/common.js';

export function slugifyPlanId(value) {
  const base = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || `plan-${randomUUID().slice(0, 8)}`;
}

export function normalizePlanRecord(plan) {
  const timestamp = nowIso();
  const source = plan && typeof plan === 'object' ? plan : {};
  const limit = normalizeInteger(source.monthlyGenerationLimit, 0);
  const planId = normalizeText(source.id) || slugifyPlanId(source.name || `plan-${limit}`);
  const defaultPlan = DEFAULT_PLANS.find(item => item.id === planId) || null;

  return {
    id: planId,
    name: normalizeText(source.name) || `Plan ${limit || ''}`.trim(),
    monthlyGenerationLimit: limit,
    priceCzk: normalizeInteger(source.priceCzk, defaultPlan?.priceCzk ?? null),
    originalPriceCzk: normalizeInteger(
      source.originalPriceCzk,
      defaultPlan?.originalPriceCzk ?? null
    ),
    discountPercent: normalizeInteger(source.discountPercent, defaultPlan?.discountPercent ?? 0),
    description: normalizeText(source.description),
    pdfProfile: normalizeText(source.pdfProfile) || defaultPlan?.pdfProfile || 'starter',
    pdfQuality: normalizeText(source.pdfQuality) || defaultPlan?.pdfQuality || 'essential',
    pdfDocuments:
      Array.isArray(source.pdfDocuments) && source.pdfDocuments.length
        ? source.pdfDocuments.map(item => normalizeText(item)).filter(Boolean)
        : defaultPlan?.pdfDocuments || [],
    isActive: source.isActive !== false,
    createdAt: source.createdAt || timestamp,
    updatedAt: source.updatedAt || timestamp,
  };
}

export function getDatabasePlans(database, { includeInactive = true } = {}) {
  const source = Array.isArray(database.plans) && database.plans.length
    ? database.plans
    : DEFAULT_PLANS;

  const plans = source.map(normalizePlanRecord);
  const filtered = includeInactive
    ? plans
    : plans.filter(plan => plan.isActive !== false);

  return filtered.sort((left, right) => {
    if (left.monthlyGenerationLimit !== right.monthlyGenerationLimit) {
      return left.monthlyGenerationLimit - right.monthlyGenerationLimit;
    }

    return left.name.localeCompare(right.name);
  });
}
