import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerEmployees } from '../services/manager-employees.js';

function context() {
  return {
    activeMembership: {
      id: 'manager-1',
      companyId: 'company-1',
      userId: 'manager-user-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

test('manager employee list uses company break rules for weekly summaries', async () => {
  const client = {
    company: {
      findUnique: async () => ({ breakMinutes: 60, standardDailyHours: '8.00' }),
    },
    companyMembership: {
      findMany: async query => {
        assert.equal(query.where.companyId, 'company-1');
        return [{
          id: 'employee-1',
          userId: 'user-1',
          companyId: 'company-1',
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          hourlyRateCzk: '300.00',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          user: {
            id: 'user-1',
            firstName: 'Anna',
            lastName: 'Novak',
            email: 'anna@example.com',
          },
          workEntries: [
            { id: 'entry-1', workDate: new Date('2026-08-24T00:00:00.000Z'), hours: '4.00', status: 'APPROVED' },
            { id: 'entry-2', workDate: new Date('2026-08-24T00:00:00.000Z'), hours: '5.00', status: 'APPROVED' },
          ],
          weeklySubmissions: [{ id: 'submission-1' }],
        }];
      },
    },
  };

  const payload = await getManagerEmployees(client, context(), new Date('2026-08-26T12:00:00.000Z'));

  assert.equal(payload.week.weekStart, '2026-08-24');
  assert.equal(payload.workRules.breakMinutes, 60);
  assert.equal(payload.employees[0].summary.totalHours, '8.00');
  assert.equal(payload.employees[0].summary.approvedHours, '8.00');
  assert.equal(payload.employees[0].summary.confirmedSalaryCzk, '2400.00');
  assert.equal(payload.employees[0].pendingSubmissions, 1);
});
