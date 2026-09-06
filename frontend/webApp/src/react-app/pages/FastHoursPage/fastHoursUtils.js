const DAY_MS = 86400000;
export const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
export const MINUTES = ['00', '10', '20', '30', '40', '50'];

export function dateKey(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
}

export function weekStartNow() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(date);
}

export function weekStartForDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay();
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() + (day === 0 ? -6 : 1 - day) * DAY_MS).toISOString().slice(0, 10);
}

export function initialWeek(current) {
  return weekStartForDate(new URLSearchParams(window.location.search).get('date')) || current;
}

export function shiftWeek(key, amount) {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + amount * 7 * DAY_MS).toISOString().slice(0, 10);
}

export function localeFor(language) {
  return language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA';
}

export function fmtLong(value, language) {
  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function fmtWeekRange(days, language) {
  if (!days.length) return '';
  const options = { day: 'numeric', month: 'long', timeZone: 'UTC' };
  return `${new Intl.DateTimeFormat(localeFor(language), options).format(new Date(`${days[0].date}T00:00:00Z`))} — ${new Intl.DateTimeFormat(localeFor(language), options).format(new Date(`${days[days.length - 1].date}T00:00:00Z`))}`;
}

export function fmtDayParts(value, language) {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat(localeFor(language), { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
    date: new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
  };
}

function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
}

export function calculateHours(startTime, endTime) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (start == null || end == null) return 0;
  if (end <= start) end += 1440;
  return Math.round(((end - start) / 60) * 100) / 100;
}

export function formatHours(value) {
  const minutes = Math.round((Number(value) || 0) * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

export function formatHoursShort(value, language) {
  const minutes = Math.round((Number(value) || 0) * 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (language === 'uk') return rest ? `${hours} год ${rest} хв` : `${hours} год`;
  if (language === 'cs') return rest ? `${hours} h ${rest} min` : `${hours} h`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatBreak(value, language) {
  const minutes = Number(value || 0);
  if (language === 'uk') return minutes === 60 ? '1 год' : `${minutes} хв`;
  if (language === 'cs') return minutes === 60 ? '1 h' : `${minutes} min`;
  return minutes === 60 ? '1h' : `${minutes}m`;
}

export function dayEntries(entries, date) {
  return entries
    .filter(entry => entry.workDate === date)
    .sort((first, second) => String(first.startTime || '').localeCompare(String(second.startTime || '')));
}

export function getDayTotal(entries, date) {
  return dayEntries(entries, date).reduce((total, entry) => total + (Number(entry.hours) || 0), 0);
}

export function closestMinute(raw) {
  const value = Number(raw || 0);
  return MINUTES.reduce(
    (best, item) => (Math.abs(Number(item) - value) < Math.abs(Number(best) - value) ? item : best),
    '00',
  );
}

export function entryLocked(entry) {
  return entry?.status === 'SUBMITTED' || entry?.status === 'APPROVED';
}

export function dateLocked(date, submissions) {
  return submissions.some(submission =>
    (submission.status === 'SUBMITTED' || submission.status === 'APPROVED') &&
    submission.weekStart <= date &&
    submission.weekEnd >= date,
  );
}
