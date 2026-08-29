const PENDING_STATUSES = new Set(['DRAFT', 'SUBMITTED']);

function toNumber(value) {
  const parsed = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateKey(entry) {
  const value = entry?.workDate ?? entry?.date;
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function sourceHours(entry) {
  return entry?.grossHours == null ? toNumber(entry?.hours) : toNumber(entry.grossHours);
}

function entryRate(entry, fallbackRate) {
  return entry?.hourlyRateCzk == null ? toNumber(fallbackRate) : toNumber(entry.hourlyRateCzk);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function format2(value) {
  return round2(value).toFixed(2);
}

function dailyBreakHours(dayEntries, fallbackBreakMinutes) {
  const hasSnapshot = dayEntries.some(entry => entry?.breakMinutes !== undefined && entry?.breakMinutes !== null);
  if (!hasSnapshot) return Math.max(0, toNumber(fallbackBreakMinutes)) / 60;
  const minutes = dayEntries.reduce(
    (max, entry) => Math.max(max, Math.max(0, toNumber(entry.breakMinutes))),
    0
  );
  return minutes / 60;
}

function distributeDayNetHours(dayEntries, netTotal, grossTotal) {
  if (grossTotal <= 0 || netTotal <= 0) {
    return dayEntries.map(entry => ({ ...entry, netHours: 0 }));
  }

  let assigned = 0;
  return dayEntries.map((entry, index) => {
    const gross = Math.max(0, sourceHours(entry));
    const netHours = index === dayEntries.length - 1
      ? Math.max(0, round2(netTotal - assigned))
      : Math.max(0, round2((gross / grossTotal) * netTotal));
    assigned = round2(assigned + netHours);
    return { ...entry, netHours };
  });
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
    const deductionHours = dailyBreakHours(dayEntries, breakMinutes);
    const grossTotal = dayEntries.reduce((sum, entry) => sum + Math.max(0, sourceHours(entry)), 0);
    const netTotal = Math.max(0, round2(grossTotal - deductionHours));
    result.push(...distributeDayNetHours(dayEntries, netTotal, grossTotal));
  }

  return result;
}

export function calculateNetWorkEntries(entries = [], rules = {}) {
  return applyDailyBreak(entries, rules.breakMinutes || 0).map(entry => ({
    ...entry,
    netHours: format2(entry.netHours),
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
    const hours = toNumber(entry.netHours);
    const rate = entryRate(entry, hourlyRateCzk);
    totalHours += hours;
    if (entry.status === 'APPROVED') {
      approvedHours += hours;
      confirmedSalary += hours * rate;
    } else if (PENDING_STATUSES.has(entry.status)) {
      pendingHours += hours;
      predictedSalary += hours * rate;
    }
  }

  return {
    totalHours: format2(totalHours),
    approvedHours: format2(approvedHours),
    pendingHours: format2(pendingHours),
    confirmedSalaryCzk: format2(confirmedSalary),
    predictedSalaryCzk: format2(predictedSalary),
  };
}

export function calculateDailyOvertime(entries = [], rules = {}) {
  const standardDailyHours = Math.max(0, toNumber(rules.standardDailyHours || 8));
  const normalized = applyDailyBreak(entries, rules.breakMinutes || 0);
  const totals = new Map();

  for (const entry of normalized) {
    const key = toDateKey(entry) || `__entry__${entry.id || totals.size}`;
    totals.set(key, (totals.get(key) || 0) + toNumber(entry.netHours));
  }

  let overtime = 0;
  for (const hours of totals.values()) overtime += Math.max(0, hours - standardDailyHours);
  return format2(overtime);
}
