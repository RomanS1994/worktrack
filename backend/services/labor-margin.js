import { calculateNetWorkEntries } from './work-time-calculation.js';

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
  for (const entry of calculateNetWorkEntries(entries, rules)) {
    const hoursHundredths = Math.round(Number(entry.netHours || 0) * 100);
    const pay = entry.hourlyRateCzk == null ? defaultPay : cents(entry.hourlyRateCzk);
    const customer = entry.customerRateCzk == null ? defaultCustomer : cents(entry.customerRateCzk);
    const revenue = Math.round(hoursHundredths * customer / 100);
    const salary = Math.round(hoursHundredths * pay / 100);
    totalRevenueCents += revenue;
    totalPayCents += salary;
    totalMarginCents += revenue - salary;
  }
  return {
    revenueCzk: money(totalRevenueCents),
    payCzk: money(totalPayCents),
    marginCzk: money(totalMarginCents),
  };
}
