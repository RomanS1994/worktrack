import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDays,
  calculateHours,
  dedupeEntries,
  formatHours,
  getDayStatus,
  getDayTotal,
  getMonthGridStart,
  getWeekStart,
  parseDateKey,
  shiftMonth,
  timeToMinutes,
  toDateKey,
  weekStartKey,
} from './calendarUtils.js';

test('calendar date helpers keep Monday-based UTC week semantics', () => {
  assert.equal(toDateKey(new Date(2026, 8, 7)), '2026-09-07');
  assert.equal(toDateKey(getWeekStart(new Date(2026, 8, 13))), '2026-09-07');
  assert.equal(weekStartKey('2026-09-13'), '2026-09-07');
  assert.equal(toDateKey(addDays(parseDateKey('2026-09-07'), 7)), '2026-09-14');
});

test('month grid starts on Monday and month shifting keeps first day', () => {
  assert.equal(toDateKey(getMonthGridStart(new Date(2026, 8, 1))), '2026-08-31');
  assert.equal(toDateKey(shiftMonth(new Date(2026, 8, 1), 1)), '2026-10-01');
  assert.equal(toDateKey(shiftMonth(new Date(2026, 0, 1), -1)), '2025-12-01');
});

test('calculateHours supports overnight work and preserves invalid-time behavior', () => {
  assert.equal(calculateHours('07:00', '15:30'), 8.5);
  assert.equal(calculateHours('22:00', '06:30'), 8.5);
  assert.equal(calculateHours('07:00', '07:00'), 24);
  assert.equal(calculateHours('24:00', '06:00'), 0);
  assert.equal(calculateHours('', '15:00'), 0);
  assert.equal(timeToMinutes('23:59'), 1439);
  assert.equal(timeToMinutes('24:00'), null);
});

test('day helpers preserve status priority and numeric hour summing', () => {
  const entries = [
    { hours: 2.5, status: 'APPROVED' },
    { hours: '3.25', status: 'SUBMITTED' },
    { hours: 1, status: 'REJECTED' },
  ];
  assert.equal(getDayTotal(entries), 6.75);
  assert.equal(getDayStatus(entries), 'REJECTED');
  assert.equal(getDayStatus([{ status: 'APPROVED' }, { status: 'DRAFT' }]), 'DRAFT');
  assert.equal(getDayStatus([]), '');
});

test('dedupeEntries keeps the latest copy for duplicate ids', () => {
  const result = dedupeEntries([
    { data: { entries: [{ id: 'a', hours: 2 }, { id: 'b', hours: 3 }] } },
    { data: { entries: [{ id: 'a', hours: 4 }] } },
    {},
  ]);
  assert.deepEqual(result, [{ id: 'a', hours: 4 }, { id: 'b', hours: 3 }]);
});

test('formatHours keeps calendar-specific hour-minute display', () => {
  assert.equal(formatHours(8), '8h 00m');
  assert.equal(formatHours(8.5), '8h 30m');
  assert.equal(formatHours(0.016), '0h 01m');
});
