import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
