const DAY_MS = 86400000;
const STATUS_PRIORITY = ['REJECTED', 'SUBMITTED', 'DRAFT', 'APPROVED'];

export function toDateKey(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
}

export function parseDateKey(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value, days) {
  return new Date(value.getTime() + days * DAY_MS);
}

export function getWeekStart(date) {
  const source = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = source.getUTCDay();
  return addDays(source, day === 0 ? -6 : 1 - day);
}

export function weekStartKey(dateKey) {
  return toDateKey(getWeekStart(parseDateKey(dateKey)));
}

export function getMonthGridStart(monthDate) {
  return getWeekStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
}

export function shiftMonth(monthDate, amount) {
  return new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1);
}

export function formatMonth(monthDate, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate);
}

export function formatLongDate(dateKey, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateKey(dateKey));
}

export function getWeekdays(locale) {
  const monday = new Date('2026-08-17T00:00:00.000Z');
  return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(addDays(monday, index)).replace('.', ''));
}

export function formatHours(value) {
  const totalMinutes = Math.round((Number(value) || 0) * 60);
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

export function getDayStatus(entries) {
  for (const status of STATUS_PRIORITY) {
    if (entries.some(entry => entry.status === status)) return status;
  }
  return '';
}

export function getDayTotal(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
}

export function dedupeEntries(weekResults) {
  const byId = new Map();
  weekResults.forEach(result => (result.data?.entries || []).forEach(entry => byId.set(entry.id, entry)));
  return Array.from(byId.values());
}

export function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function calculateHours(startTime, endTime) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (start == null || end == null) return 0;
  if (end <= start) end += 1440;
  return Math.round(((end - start) / 60) * 100) / 100;
}
