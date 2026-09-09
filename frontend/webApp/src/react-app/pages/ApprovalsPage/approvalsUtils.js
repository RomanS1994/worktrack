import { getLocalDateKey } from '../../app/formatters.js';

export const PROBLEM_STATUSES = new Set(['MISMATCH', 'MISSING_MANAGER', 'MISSING_EMPLOYEE']);

export function getEmployeeName(submission, fallback) {
  const employee = submission?.employee;
  return employee?.name || employee?.email || fallback;
}

function parseDate(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function isWeekStillOpen(submission) {
  const weekEnd = String(submission?.weekEnd || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(weekEnd) && getLocalDateKey() <= weekEnd;
}

function cleanFormattedDate(value) {
  return value.replace(/\s+р\.$/u, '').replace(/\s+/g, ' ').trim();
}

export function formatPeriod(submission, locale) {
  const start = parseDate(submission?.weekStart);
  const end = parseDate(submission?.weekEnd);
  if (!start || !end) return '—';

  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    const endParts = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(end);
    const month = endParts.find(part => part.type === 'month')?.value || '';
    const year = endParts.find(part => part.type === 'year')?.value || '';
    return `${start.getUTCDate()} – ${end.getUTCDate()} ${month} ${year}`.trim();
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${cleanFormattedDate(formatter.format(start))} – ${cleanFormattedDate(formatter.format(end))}`;
}

export function formatLongDate(value, locale) {
  const date = parseDate(value);
  if (!date) return '';
  const formatted = cleanFormattedDate(new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatEntryDate(value, locale) {
  const date = parseDate(value);
  if (!date) return { weekday: '', day: '' };
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .replaceAll('.', '');
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day: String(date.getUTCDate()),
  };
}

export function formatHours(value) {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} h` : '—';
}

export function formatSignedHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)} h`;
}

export function sortEntries(entries = []) {
  return [...entries].sort((first, second) => {
    const dateComparison = String(first.workDate).localeCompare(String(second.workDate));
    if (dateComparison) return dateComparison;
    return String(first.startTime || '').localeCompare(String(second.startTime || ''));
  });
}

export function mismatchCountLabel(count, language) {
  if (language === 'en') return `${count} ${count === 1 ? 'entry has' : 'entries have'} a mismatch`;
  if (language === 'cs') return count === 1 ? 'Nesrovnalost v 1 záznamu' : `Nesrovnalosti v ${count} záznamech`;
  return count === 1 ? 'Є невідповідності у 1 записі' : `Є невідповідності у ${count} записах`;
}

export function getMismatchReason(day, copy) {
  if (!day) return '';
  if (day.status === 'MISSING_MANAGER') return copy.missingManager;
  if (day.status === 'MISSING_EMPLOYEE') return copy.missingEmployee;

  const reasons = [];
  if (day.reasons?.includes('hours')) {
    const difference = Number(day.employeeHours || 0) - Number(day.managerHours || 0);
    const side = difference >= 0 ? copy.moreInApproval : copy.moreInTimesheet;
    reasons.push(`${copy.hoursDiffer} (${formatSignedHours(Math.abs(difference))} ${side})`);
  }
  if (day.reasons?.includes('break')) {
    reasons.push(`${copy.breakDiffers} (${day.employeeBreakMinutes ?? 0} / ${day.managerBreakMinutes ?? 0} ${copy.minutes})`);
  }
  if (day.reasons?.includes('project')) reasons.push(copy.projectDiffers);
  return reasons.join(' · ');
}

export function calculateShiftHours(startTime, endTime, breakMinutes) {
  if (!/^\d{2}:\d{2}$/.test(startTime || '') || !/^\d{2}:\d{2}$/.test(endTime || '')) return null;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  const grossMinutes = end - start;
  if (grossMinutes <= 0 || grossMinutes > 1440) return null;
  const lunch = grossMinutes > breakMinutes ? breakMinutes : 0;
  return Math.max(0, (grossMinutes - lunch) / 60);
}
