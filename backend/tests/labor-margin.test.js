import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLaborMargin } from '../services/labor-margin.js';

test('calculates margin on net hours after a daily break', () => {
  const result = calculateLaborMargin([
    { workDate: '2026-09-18', hours: '8.00', hourlyRateCzk: '220.00', status: 'APPROVED' },
  ], 220, 300, { breakMinutes: 60 });
  assert.deepEqual(result, { revenueCzk: '2100.00', payCzk: '1540.00', marginCzk: '560.00' });
});

test('includes manager hours with equal rates and zero margin', () => {
  const result = calculateLaborMargin([{ workDate: '2026-09-18', hours: '8.00', status: 'SUBMITTED' }], 350, 350);
  assert.deepEqual(result, { revenueCzk: '2800.00', payCzk: '2800.00', marginCzk: '0.00' });
});

test('uses historical rate snapshots when available', () => {
  const result = calculateLaborMargin([{ workDate: '2026-09-18', hours: '2.00', hourlyRateCzk: '200.00', customerRateCzk: '290.00' }], 220, 300);
  assert.equal(result.marginCzk, '180.00');
});
