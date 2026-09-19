import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLaborMargin } from '../services/labor-margin.js';

test('calculates margin on net hours after a daily break', () => {
  const result = calculateLaborMargin([
    { workDate: '2026-09-18', hours: '8.00', hourlyRateCzk: '220.00', status: 'APPROVED' },
  ], 220, 300, { breakMinutes: 60 });
  assert.equal(result.revenueCzk, '2100.00');
  assert.equal(result.payCzk, '1540.00');
  assert.equal(result.marginCzk, '560.00');
  assert.equal(result.confirmedMarginCzk, '560.00');
});

test('includes manager hours with equal rates and zero margin', () => {
  const result = calculateLaborMargin([{ workDate: '2026-09-18', hours: '8.00', status: 'SUBMITTED' }], 350, 350);
  assert.equal(result.revenueCzk, '2800.00');
  assert.equal(result.payCzk, '2800.00');
  assert.equal(result.marginCzk, '0.00');
});

test('uses historical rate snapshots when available', () => {
  const result = calculateLaborMargin([{ workDate: '2026-09-18', hours: '2.00', hourlyRateCzk: '200.00', customerRateCzk: '290.00', status: 'APPROVED' }], 220, 300);
  assert.equal(result.marginCzk, '180.00');
});

test('uses current customer rate for legacy fallback snapshots created before customer pricing existed', () => {
  const result = calculateLaborMargin([
    {
      workDate: '2026-09-18',
      createdAt: '2026-09-18T12:00:00.000Z',
      hours: '10.00',
      hourlyRateCzk: '250.00',
      customerRateCzk: '250.00',
      status: 'APPROVED',
    },
  ], 250, 300);
  assert.equal(result.marginCzk, '500.00');
});

test('keeps explicit equal-rate snapshots created after customer pricing launch at zero margin', () => {
  const result = calculateLaborMargin([
    {
      workDate: '2026-09-19',
      createdAt: '2026-09-19T12:00:00.000Z',
      hours: '10.00',
      hourlyRateCzk: '250.00',
      customerRateCzk: '250.00',
      status: 'APPROVED',
    },
  ], 250, 300);
  assert.equal(result.marginCzk, '0.00');
});

test('does not count draft entries', () => {
  const result = calculateLaborMargin([
    { workDate: '2026-09-18', hours: '8.00', hourlyRateCzk: '220.00', customerRateCzk: '300.00', status: 'DRAFT' },
  ], 220, 300);
  assert.equal(result.marginCzk, '0.00');
});

test('calculates the requested 220/300 rate example for 51 net hours', () => {
  const result = calculateLaborMargin([
    { workDate: '2026-09-18', hours: '51.00', hourlyRateCzk: '220.00', customerRateCzk: '300.00', status: 'APPROVED' },
  ], 220, 300);
  assert.equal(result.marginCzk, '4080.00');
  assert.equal(result.confirmedMarginCzk, '4080.00');
});

test('does not count rejected entries or deduct their breaks from valid hours', () => {
  const result = calculateLaborMargin([
    { workDate: '2026-09-18', hours: '8.00', status: 'APPROVED', breakMinutes: 60 },
    { workDate: '2026-09-18', hours: '8.00', status: 'REJECTED', breakMinutes: 120 },
  ], 220, 300);
  assert.equal(result.revenueCzk, '2100.00');
  assert.equal(result.payCzk, '1540.00');
  assert.equal(result.marginCzk, '560.00');
});
