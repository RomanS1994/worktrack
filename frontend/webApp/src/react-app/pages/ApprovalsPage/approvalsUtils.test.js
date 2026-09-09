import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateShiftHours,
  formatEntryDate,
  formatHours,
  formatLongDate,
  formatPeriod,
  formatSignedHours,
  getEmployeeName,
  getMismatchReason,
  isWeekStillOpen,
  mismatchCountLabel,
  sortEntries,
} from './approvalsUtils.js';

test('calculateShiftHours applies the configured break only when the shift is longer than the break', () => {
  assert.equal(calculateShiftHours('07:00', '15:30', 30), 8);
  assert.equal(calculateShiftHours('07:00', '07:20', 30), 1 / 3);
});

test('calculateShiftHours supports overnight shifts and rejects invalid times', () => {
  assert.equal(calculateShiftHours('22:00', '06:30', 30), 8);
  assert.equal(calculateShiftHours('24:00', '06:00', 30), null);
  assert.equal(calculateShiftHours('08:00', '99:00', 30), null);
  assert.equal(calculateShiftHours('', '15:00', 30), null);
});

test('sortEntries orders by work date and then start time without mutating input', () => {
  const entries = [
    { id: 'b', workDate: '2026-09-02', startTime: '09:00' },
    { id: 'c', workDate: '2026-09-01', startTime: '10:00' },
    { id: 'a', workDate: '2026-09-01', startTime: '07:00' },
  ];

  assert.deepEqual(sortEntries(entries).map(entry => entry.id), ['a', 'c', 'b']);
  assert.deepEqual(entries.map(entry => entry.id), ['b', 'c', 'a']);
});

test('hour formatters preserve approval-specific two-decimal display semantics', () => {
  assert.equal(formatHours(8), '8.00 h');
  assert.equal(formatHours(null), '—');
  assert.equal(formatSignedHours(1.5), '+1.50 h');
  assert.equal(formatSignedHours(-1.5), '-1.50 h');
});

test('approval period formatter keeps its distinct same-month presentation', () => {
  assert.equal(
    formatPeriod({ weekStart: '2026-09-01', weekEnd: '2026-09-07' }, 'en-GB'),
    '1 – 7 September 2026',
  );
  assert.equal(
    formatPeriod({ weekStart: '2026-08-31', weekEnd: '2026-09-06' }, 'en-GB'),
    '31 Aug 2026 – 6 Sept 2026',
  );
  assert.equal(formatPeriod({ weekStart: '', weekEnd: '2026-09-06' }, 'en-GB'), '—');
});

test('approval date formatters use UTC calendar dates and approval casing rules', () => {
  assert.equal(formatLongDate('2026-09-07', 'en-GB'), 'Monday, 7 September 2026');
  assert.deepEqual(formatEntryDate('2026-09-07', 'en-GB'), { weekday: 'Mon', day: '7' });
  assert.deepEqual(formatEntryDate('', 'en-GB'), { weekday: '', day: '' });
});

test('approval employee name reads the submission employee shape and respects fallback', () => {
  assert.equal(getEmployeeName({ employee: { name: 'Jane Doe', email: 'jane@example.com' } }, 'Employee'), 'Jane Doe');
  assert.equal(getEmployeeName({ employee: { email: 'jane@example.com' } }, 'Employee'), 'jane@example.com');
  assert.equal(getEmployeeName({}, 'Employee'), 'Employee');
});

test('getMismatchReason describes hours, break and project mismatches', () => {
  const copy = {
    moreInApproval: 'more in approval',
    moreInTimesheet: 'more in timesheet',
    hoursDiffer: 'Hours differ',
    breakDiffers: 'Break differs',
    projectDiffers: 'Project differs',
    minutes: 'min',
    missingManager: 'Missing manager entry',
    missingEmployee: 'Missing employee entry',
  };

  assert.equal(
    getMismatchReason({
      status: 'MISMATCH',
      reasons: ['hours', 'break', 'project'],
      employeeHours: 8,
      managerHours: 7.5,
      employeeBreakMinutes: 30,
      managerBreakMinutes: 60,
    }, copy),
    'Hours differ (+0.50 h more in approval) · Break differs (30 / 60 min) · Project differs',
  );
  assert.equal(getMismatchReason({ status: 'MISSING_MANAGER' }, copy), 'Missing manager entry');
  assert.equal(getMismatchReason({ status: 'MISSING_EMPLOYEE' }, copy), 'Missing employee entry');
});

test('mismatchCountLabel keeps language-specific singular and plural wording', () => {
  assert.equal(mismatchCountLabel(1, 'en'), '1 entry has a mismatch');
  assert.equal(mismatchCountLabel(2, 'en'), '2 entries have a mismatch');
  assert.equal(mismatchCountLabel(1, 'cs'), 'Nesrovnalost v 1 záznamu');
  assert.equal(mismatchCountLabel(2, 'uk'), 'Є невідповідності у 2 записах');
});

test('isWeekStillOpen rejects malformed and past week ends and accepts a far-future week', () => {
  assert.equal(isWeekStillOpen({ weekEnd: 'not-a-date' }), false);
  assert.equal(isWeekStillOpen({ weekEnd: '2000-01-01' }), false);
  assert.equal(isWeekStillOpen({ weekEnd: '2999-12-31' }), true);
});
