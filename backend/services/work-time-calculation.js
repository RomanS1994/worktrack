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

function sourceRate(entry, fallbackRate) {
  return entry?.hourlyRateCzk == null ? toNumber(fallbackRate) : toNumber(entry.hourlyRateCzk);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function format2(value) {
  return round2(value).toFixed(2);
}

function applyDailyBreak(entries, breakMinutes) {
  const deductionHours = Math.max(0, toNumber(breakMinutes)) / 60;
  if (!deductionHours) return entries.map(entry => ({ ...entry, netHours: sourceHours(entry) }));

  const byDay = new Map();
  for (const entry of entries) {
    const key = toDateKey(entry) || `__entry__${entry.id || byDay.size}`;
    const list = byDay.get(key) || [];
    list.push(entry);
    byDay.set(key, list);
  }

  const result = [];
  for (const dayEntries of byDay.values()) {
    const grossTotal = dayEntries.reduce((sum, entry) => sum + sourceHours(entry), 0);
    const netTotal = Math.max(0, grossTotal - deductionHours);
    let remaining = netTotal;

    dayEntries.forEach((entry, index) => {
      const gross = sourceHours(entry);
      const netHours = index === dayEntries.length - 1
        ? Math.max(0, remaining)
        : Math.min(gross, Math.max(0, remaining));
      remaining = round2(remaining - netHours);
      result.push({ ...entry, netHours: round2(netHours) });
    });
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
  let confirmedSalaryCzk = 0;
  let predictedSalaryCzk = 0;

  for (const entry of normalized) {
    const hours = toNumber(entry.netHours);
    const rate = sourceRate(entry, hourlyRateCzk);
    totalHours += hours;
    if (entry.status === 'APPROVED') {
      approvedHours += hours;
      confirmedSalaryCzk += hours * rate;
    } else if (PENDING_STATUSES.has(entry.status)) {
      pendingHours += hours;
      predictedSalaryCzk += hours * rate;
    }
  }

  return {
    totalHours: format2(totalHours),
    approvedHours: format2(approvedHours),
    pendingHours: format2(pendingHours),
    confirmedSalaryCzk: format2(confirmedSalaryCzk),
    predictedSalaryCzk: format2(predictedSalaryCzk),
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
