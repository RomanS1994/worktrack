const PENDING_STATUSES = new Set(['DRAFT', 'SUBMITTED']);

function toNumber(value) {
  const parsed = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toHundredths(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100);
}

function formatHundredths(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(value));
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

function toDateKey(entry) {
  const value = entry?.workDate ?? entry?.date;
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function sourceHourHundredths(entry) {
  const value = entry?.grossHours == null ? entry?.hours : entry.grossHours;
  return Math.max(0, toHundredths(value));
}

function entryRateHundredths(entry, fallbackRate) {
  const value = entry?.hourlyRateCzk == null ? fallbackRate : entry.hourlyRateCzk;
  return Math.max(0, toHundredths(value));
}

function salaryHundredths(hourHundredths, rateHundredths) {
  return Math.round((hourHundredths * rateHundredths) / 100);
}

function dailyBreakHourHundredths(dayEntries, fallbackBreakMinutes) {
  const hasSnapshot = dayEntries.some(entry => entry?.breakMinutes !== undefined && entry?.breakMinutes !== null);
  const minutes = hasSnapshot
    ? dayEntries.reduce((max, entry) => Math.max(max, Math.max(0, toNumber(entry.breakMinutes))), 0)
    : Math.max(0, toNumber(fallbackBreakMinutes));
  return Math.max(0, Math.round((minutes * 100) / 60));
}

function allocationKey(entry, index) {
  return [
    entry?.id || '',
    entry?.projectId || '',
    entry?.employeeMembershipId || '',
    toDateKey(entry),
    String(entry?.hours ?? entry?.grossHours ?? ''),
    String(entry?.hourlyRateCzk ?? ''),
    String(index),
  ].join('|');
}

function distributeDayNetHourHundredths(dayEntries, netTotal, grossTotal) {
  if (grossTotal <= 0 || netTotal <= 0) {
    return dayEntries.map(entry => ({ ...entry, netHourHundredths: 0 }));
  }

  const allocations = dayEntries.map((entry, index) => {
    const gross = sourceHourHundredths(entry);
    const numerator = gross * netTotal;
    return {
      index,
      key: allocationKey(entry, index),
      assigned: Math.floor(numerator / grossTotal),
      remainder: numerator % grossTotal,
    };
  });

  const assignedTotal = allocations.reduce((sum, item) => sum + item.assigned, 0);
  const remaining = Math.max(0, netTotal - assignedTotal);
  const priority = [...allocations].sort((a, b) =>
    b.remainder - a.remainder || a.key.localeCompare(b.key)
  );

  for (let index = 0; index < remaining; index += 1) {
    priority[index % priority.length].assigned += 1;
  }

  return dayEntries.map((entry, index) => ({
    ...entry,
    netHourHundredths: allocations[index].assigned,
  }));
}

function applyDailyBreak(entries, breakMinutes) {
  const byDay = new Map();
  for (const entry of entries) {
    const key = toDateKey(entry) || `__entry__${entry.id || byDay.size}`;
    const list = byDay.get(key) || [];
    list.push(entry);
    byDay.set(key, list);
  }

  const result = [];
  for (const dayEntries of byDay.values()) {
    const deduction = dailyBreakHourHundredths(dayEntries, breakMinutes);
    const grossTotal = dayEntries.reduce((sum, entry) => sum + sourceHourHundredths(entry), 0);
    const netTotal = Math.max(0, grossTotal - deduction);
    result.push(...distributeDayNetHourHundredths(dayEntries, netTotal, grossTotal));
  }

  return result;
}

export function calculateNetWorkEntries(entries = [], rules = {}) {
  return applyDailyBreak(entries, rules.breakMinutes || 0).map(({ netHourHundredths, ...entry }) => ({
    ...entry,
    netHours: formatHundredths(netHourHundredths),
  }));
}

export function calculateNetWorkSummary(entries = [], hourlyRateCzk = 0, rules = {}) {
  const normalized = applyDailyBreak(entries, rules.breakMinutes || 0);
  let totalHours = 0;
  let approvedHours = 0;
  let pendingHours = 0;
  let confirmedSalary = 0;
  let predictedSalary = 0;

  for (const entry of normalized) {
    const hours = entry.netHourHundredths;
    const rate = entryRateHundredths(entry, hourlyRateCzk);
    totalHours += hours;
    if (entry.status === 'APPROVED') {
      approvedHours += hours;
      confirmedSalary += salaryHundredths(hours, rate);
    } else if (PENDING_STATUSES.has(entry.status)) {
      pendingHours += hours;
      predictedSalary += salaryHundredths(hours, rate);
    }
  }

  return {
    totalHours: formatHundredths(totalHours),
    approvedHours: formatHundredths(approvedHours),
    pendingHours: formatHundredths(pendingHours),
    confirmedSalaryCzk: formatHundredths(confirmedSalary),
    predictedSalaryCzk: formatHundredths(predictedSalary),
  };
}

export function calculateDailyOvertime(entries = [], rules = {}) {
  const standardDailyHourHundredths = Math.max(0, toHundredths(rules.standardDailyHours || 8));
  const normalized = applyDailyBreak(entries, rules.breakMinutes || 0);
  const totals = new Map();

  for (const entry of normalized) {
    const key = toDateKey(entry) || `__entry__${entry.id || totals.size}`;
    totals.set(key, (totals.get(key) || 0) + entry.netHourHundredths);
  }

  let overtime = 0;
  for (const hours of totals.values()) overtime += Math.max(0, hours - standardDailyHourHundredths);
  return formatHundredths(overtime);
}
