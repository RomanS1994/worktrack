import { normalizeText } from '../validation/common.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDate(value, message = 'Invalid week start') {
  const raw = normalizeText(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(message);
  }

  return parsed;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function toIsoDate(date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function getWeekRange(value = new Date()) {
  const source = value instanceof Date ? value : parseDate(value);
  const dayStart = startOfUtcDay(source);
  const utcDay = dayStart.getUTCDay();
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const weekStart = addDays(dayStart, mondayOffset);
  const nextWeekStart = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  return {
    weekStart,
    weekEnd,
    nextWeekStart,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        dateKey: toIsoDate(date),
        label: WEEKDAY_LABELS[date.getUTCDay()],
      };
    }),
  };
}

export function serializeWeek(range) {
  return {
    weekStart: toIsoDate(range.weekStart),
    weekEnd: toIsoDate(range.weekEnd),
    days: range.days.map(day => ({
      date: day.dateKey,
      label: day.label,
    })),
  };
}
