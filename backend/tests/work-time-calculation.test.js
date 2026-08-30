import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDailyOvertime,
  calculateNetWorkEntries,
  calculateNetWorkSummary,
} from '../services/work-time-calculation.js';

const workDate = new Date('2026-08-17T00:00:00.000Z');

test('daily lunch is distributed proportionally across projects', () => {
  const entries = [
    { id: 'a', workDate, hours: '4.00', status: 'APPROVED', hourlyRateCzk: '250.00' },
    { id: 'b', workDate, hours: '5.00', status: 'APPROVED', hourlyRateCzk: '250.00' },
  ];

  const normalized = calculateNetWorkEntries(entries, { breakMinutes: 60 });
  assert.deepEqual(normalized.map(entry => entry.netHours), ['3.56', '4.44']);
  assert.equal(normalized.reduce((sum, entry) => sum + Number(entry.netHours), 0), 8);
});

test('daily lunch allocation is independent of entry order', () => {
  const entries = [
    { id: 'low', workDate, hours: '4.00', status: 'APPROVED', hourlyRateCzk: '200.00' },
    { id: 'high', workDate, hours: '4.00', status: 'APPROVED', hourlyRateCzk: '300.00' },
  ];

  const forward = calculateNetWorkSummary(entries, 0, { breakMinutes: 60 });
  const reversed = calculateNetWorkSummary([...entries].reverse(), 0, { breakMinutes: 60 });

  assert.equal(forward.totalHours, '7.00');
  assert.equal(forward.confirmedSalaryCzk, '1750.00');
  assert.deepEqual(reversed, forward);
});

test('mixed-rate salary stays stable when proportional rounding leaves residual hundredths', () => {
  const entries = [
    { id: 'a', workDate, hours: '1.00', status: 'APPROVED', hourlyRateCzk: '199.99' },
    { id: 'b', workDate, hours: '2.00', status: 'APPROVED', hourlyRateCzk: '333.33' },
    { id: 'c', workDate, hours: '3.00', status: 'APPROVED', hourlyRateCzk: '250.00' },
  ];

  const forward = calculateNetWorkSummary(entries, 0, { breakMinutes: 30 });
  const reversed = calculateNetWorkSummary([...entries].reverse(), 0, { breakMinutes: 30 });

  assert.equal(forward.totalHours, '5.50');
  assert.deepEqual(reversed, forward);
});

test('stored hourly-rate snapshots override the current membership rate', () => {
  const entries = [
    { id: 'old', workDate, hours: '2.00', status: 'APPROVED', hourlyRateCzk: '200.00' },
    { id: 'new', workDate: new Date('2026-08-18T00:00:00.000Z'), hours: '2.00', status: 'APPROVED', hourlyRateCzk: '300.00' },
  ];

  const summary = calculateNetWorkSummary(entries, '999.00', { breakMinutes: 0 });
  assert.equal(summary.totalHours, '4.00');
  assert.equal(summary.confirmedSalaryCzk, '1000.00');
});

test('fallback rate is used only when an entry has no historical rate snapshot', () => {
  const entries = [
    { id: 'snapshot', workDate, hours: '1.00', status: 'APPROVED', hourlyRateCzk: '200.00' },
    { id: 'fallback', workDate: new Date('2026-08-18T00:00:00.000Z'), hours: '1.00', status: 'APPROVED' },
  ];

  const summary = calculateNetWorkSummary(entries, '250.00', { breakMinutes: 0 });
  assert.equal(summary.confirmedSalaryCzk, '450.00');
});

test('stored break snapshot overrides the current company rule', () => {
  const snapshotEntries = [
    { id: 'a', workDate, hours: '8.00', status: 'APPROVED', breakMinutes: 60 },
  ];
  const noBreakSnapshot = [
    { id: 'b', workDate, hours: '8.00', status: 'APPROVED', breakMinutes: 0 },
  ];

  assert.equal(calculateNetWorkSummary(snapshotEntries, 200, { breakMinutes: 30 }).totalHours, '7.00');
  assert.equal(calculateNetWorkSummary(noBreakSnapshot, 200, { breakMinutes: 60 }).totalHours, '8.00');
});

test('break deduction never produces negative hours or salary', () => {
  const entries = [
    { id: 'short', workDate, hours: '0.50', status: 'APPROVED', hourlyRateCzk: '250.00' },
  ];

  const summary = calculateNetWorkSummary(entries, 0, { breakMinutes: 60 });
  assert.equal(summary.totalHours, '0.00');
  assert.equal(summary.confirmedSalaryCzk, '0.00');
});

test('daily overtime uses the same net-hour calculation as payroll', () => {
  const entries = [
    { id: 'a', workDate, hours: '5.00', status: 'APPROVED' },
    { id: 'b', workDate, hours: '5.00', status: 'APPROVED' },
  ];

  assert.equal(calculateNetWorkSummary(entries, 0, { breakMinutes: 60 }).totalHours, '9.00');
  assert.equal(calculateDailyOvertime(entries, { breakMinutes: 60, standardDailyHours: 8 }), '1.00');
});
