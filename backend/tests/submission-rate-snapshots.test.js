import assert from 'node:assert/strict';
import test from 'node:test';

import { freezeSubmissionHourlyRateSnapshots } from '../services/submission-rate-snapshots.js';

test('submission snapshot freezes missing pay and customer rates for the submitted week', async () => {
  const calls = [];
  const client = {
    workEntry: {
      updateMany: async args => {
        calls.push(args);
        return { count: 3 };
      },
    },
  };

  const result = await freezeSubmissionHourlyRateSnapshots(
    client,
    { id: 'membership-1', companyId: 'company-1', hourlyRateCzk: '275.50', customerRateCzk: '325.00' },
    { id: 'submission-1' },
  );

  assert.deepEqual(result, { count: 3 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    where: {
      companyId: 'company-1',
      employeeMembershipId: 'membership-1',
      weeklySubmissionId: 'submission-1',
      OR: [
        { hourlyRateCzk: null },
        { customerRateCzk: null },
      ],
    },
    data: { hourlyRateCzk: '275.50', customerRateCzk: '325.00' },
  });
});

test('submission snapshot falls back customer rate to the pay rate when unset', async () => {
  let call = null;
  const client = {
    workEntry: {
      updateMany: async args => {
        call = args;
        return { count: 1 };
      },
    },
  };

  await freezeSubmissionHourlyRateSnapshots(
    client,
    { id: 'membership-1', companyId: 'company-1', hourlyRateCzk: '275.50', customerRateCzk: null },
    { id: 'submission-1' },
  );

  assert.equal(call.data.customerRateCzk, '275.50');
});

test('submission snapshot leaves the database untouched when current rate is missing', async () => {
  let called = false;
  const client = {
    workEntry: {
      updateMany: async () => {
        called = true;
        return { count: 1 };
      },
    },
  };

  const result = await freezeSubmissionHourlyRateSnapshots(
    client,
    { id: 'membership-1', companyId: 'company-1', hourlyRateCzk: null },
    { id: 'submission-1' },
  );

  assert.deepEqual(result, { count: 0 });
  assert.equal(called, false);
});
