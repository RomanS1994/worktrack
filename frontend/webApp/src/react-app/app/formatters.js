export const APP_LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };

export function resolveLocale(language) {
  return APP_LOCALES[language] || APP_LOCALES.uk;
}

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCzk(value, locale = APP_LOCALES.uk) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(safeNumber(value))} Kč`;
}

export function formatHours(value, locale = APP_LOCALES.uk) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(safeNumber(value))} h`;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthKeyFromAnchor(anchor) {
  return String(anchor || getLocalDateKey()).slice(0, 7);
}

export function shiftAnchor(anchor, period, direction) {
  const source = new Date(`${anchor}T00:00:00.000Z`);
  if (period === 'month') {
    return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + direction, 1)).toISOString().slice(0, 10);
  }
  return new Date(source.getTime() + direction * 7 * 86400000).toISOString().slice(0, 10);
}

export function formatPeriod(start, end, locale = APP_LOCALES.uk) {
  if (!start || !end) return '—';
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth()) {
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(endDate);
    return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${monthYear}`;
  }
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function formatMonthPeriod(month, locale = APP_LOCALES.uk) {
  if (!month) return '—';
  const [year, monthNumber] = String(month).split('-').map(Number);
  if (!year || !monthNumber) return '—';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function businessDaysInMonth(month) {
  if (!month) return 0;
  const [year, monthNumber] = String(month).split('-').map(Number);
  if (!year || !monthNumber) return 0;
  const end = new Date(Date.UTC(year, monthNumber, 1));
  let days = 0;
  for (let date = new Date(Date.UTC(year, monthNumber - 1, 1)); date < end; date = new Date(date.getTime() + 86400000)) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return days;
}

export function getEmployeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || '—';
}
