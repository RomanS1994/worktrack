import assert from 'node:assert/strict';
import test from 'node:test';

import { getEmployeeWeekRange } from '../services/employee-work.js';
import { getWeekRange, serializeWeek } from '../services/week-utils.js';

function normalizeRange(range) {
  return {
    weekStart: range.weekStart.toISOString(),
    weekEnd: range.weekEnd.toISOString(),
    nextWeekStart: range.nextWeekStart.toISOString(),
    days: range.days.map(day => ({
      date: day.date.toISOString(),
      dateKey: day.dateKey,
      label: day.label,
    })),
  };
}

test('employee week range matches shared week-utils contract', () => {
  for (const value of ['2026-09-07', '2026-09-13', '2026-01-01', new Date('2026-12-31T18:30:00.000Z')]) {
    assert.deepEqual(normalizeRange(getEmployeeWeekRange(value)), normalizeRange(getWeekRange(value)));
  }
});

test('shared week serialization preserves employee-facing week shape', () => {
  const range = getEmployeeWeekRange('2026-09-13');

  assert.deepEqual(serializeWeek(range), {
    weekStart: '2026-09-07',
    weekEnd: '2026-09-13',
    days: [
      { date: '2026-09-07', label: 'Mon' },
      { date: '2026-09-08', label: 'Tue' },
      { date: '2026-09-09', label: 'Wed' },
      { date: '2026-09-10', label: 'Thu' },
      { date: '2026-09-11', label: 'Fri' },
      { date: '2026-09-12', label: 'Sat' },
      { date: '2026-09-13', label: 'Sun' },
    ],
  });
});
