import { calculateNetWorkEntries } from './work-time-calculation.js';

const CUSTOMER_RATE_SNAPSHOT_RELEASE_MS = Date.parse('2026-09-19T00:30:00.000Z');

function cents(value) {
  const amount = Number(String(value ?? '0').replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid hourly rate');
  return Math.round(amount * 100);
}

function money(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function timestamp(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isLegacyFallbackCustomerSnapshot(entry, payCents, customerCents, defaultCustomerCents) {
  const createdAt = timestamp(entry?.createdAt);
  return createdAt != null
    && createdAt < CUSTOMER_RATE_SNAPSHOT_RELEASE_MS
    && customerCents === payCents
    && defaultCustomerCents !== payCents;
}

export function resolveLaborCustomerRateCzk(entry = {}, payRateCzk = 0, customerRateCzk = payRateCzk) {
  const defaultCustomer = cents(customerRateCzk);
  const defaultPay = cents(payRateCzk);
  const pay = entry.hourlyRateCzk == null ? defaultPay : cents(entry.hourlyRateCzk);
  const snapshotCustomer = entry.customerRateCzk == null ? defaultCustomer : cents(entry.customerRateCzk);
  const customer = isLegacyFallbackCustomerSnapshot(entry, pay, snapshotCustomer, defaultCustomer)
    ? defaultCustomer
    : snapshotCustomer;
  return money(customer);
}

/**
 * Calculate the difference between the customer rate and the employee's pay
 * using the same net hours (including deducted breaks) as payroll.
 * Entries may carry a historical pay-rate snapshot; customer-rate snapshots
 * take precedence over the current membership rate when available.
 */
export function calculateLaborMargin(entries = [], payRateCzk = 0, customerRateCzk = payRateCzk, rules = {}) {
  const defaultPay = cents(payRateCzk);
  const defaultCustomer = cents(customerRateCzk);
  let totalMarginCents = 0;
  let totalRevenueCents = 0;
  let totalPayCents = 0;
  let confirmedRevenueCents = 0;
  let predictedRevenueCents = 0;
  let confirmedMarginCents = 0;
  let predictedMarginCents = 0;
  const eligibleEntries = entries.filter(entry => ['SUBMITTED', 'APPROVED'].includes(entry.status));
  for (const entry of calculateNetWorkEntries(eligibleEntries, rules)) {
    const hoursHundredths = Math.round(Number(entry.netHours || 0) * 100);
    const pay = entry.hourlyRateCzk == null ? defaultPay : cents(entry.hourlyRateCzk);
    const snapshotCustomer = entry.customerRateCzk == null ? defaultCustomer : cents(entry.customerRateCzk);
    const customer = isLegacyFallbackCustomerSnapshot(entry, pay, snapshotCustomer, defaultCustomer)
      ? defaultCustomer
      : snapshotCustomer;
    const revenue = Math.round(hoursHundredths * customer / 100);
    const salary = Math.round(hoursHundredths * pay / 100);
    totalRevenueCents += revenue;
    totalPayCents += salary;
    totalMarginCents += revenue - salary;
    if (entry.status === 'APPROVED') {
      confirmedRevenueCents += revenue;
      confirmedMarginCents += revenue - salary;
    } else if (entry.status === 'SUBMITTED') {
      predictedRevenueCents += revenue;
      predictedMarginCents += revenue - salary;
    }
  }
  return {
    revenueCzk: money(totalRevenueCents),
    payCzk: money(totalPayCents),
    marginCzk: money(totalMarginCents),
    confirmedRevenueCzk: money(confirmedRevenueCents),
    predictedRevenueCzk: money(predictedRevenueCents),
    confirmedMarginCzk: money(confirmedMarginCents),
    predictedMarginCzk: money(predictedMarginCents),
  };
}
