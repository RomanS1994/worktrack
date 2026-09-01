import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagerPayroll } from '../services/manager-payroll.js';
import { previewInvoiceDraft } from '../services/invoices.js';

const entries = [
  {
    id: 'entry-1',
    workDate: new Date('2026-08-03T00:00:00.000Z'),
    createdAt: new Date('2026-08-03T08:00:00.000Z'),
    status: 'APPROVED',
    hours: '4.00',
    grossHours: null,
    breakMinutes: 60,
    hourlyRateCzk: '200.00',
    project: { name: 'Project A' },
  },
  {
    id: 'entry-2',
    workDate: new Date('2026-08-03T00:00:00.000Z'),
    createdAt: new Date('2026-08-03T12:00:00.000Z'),
    status: 'APPROVED',
    hours: '5.00',
    grossHours: null,
    breakMinutes: 60,
    hourlyRateCzk: '300.00',
    project: { name: 'Project B' },
  },
  {
    id: 'entry-3',
    workDate: new Date('2026-08-04T00:00:00.000Z'),
    createdAt: new Date('2026-08-04T08:00:00.000Z'),
    status: 'APPROVED',
    hours: '8.00',
    grossHours: null,
    breakMinutes: 30,
    hourlyRateCzk: '250.00',
    project: { name: 'Project C' },
  },
];

const employeeMembership = {
  id: 'employee-1',
  userId: 'user-1',
  companyId: 'company-1',
  role: 'EMPLOYEE',
  status: 'ACTIVE',
  hourlyRateCzk: '350.00',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function managerContext() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    activeCompany: { id: 'company-1', name: 'Employer' },
  };
}

function employeeContext() {
  return { activeMembership: employeeMembership };
}

function client() {
  return {
    companyMembership: {
      findMany: async () => [{
        ...employeeMembership,
        user: {
          id: 'user-1',
          firstName: 'Worker',
          lastName: 'One',
          email: 'worker@example.com',
          deletedAt: null,
        },
        workEntries: entries,
      }],
    },
    salaryAdvance: {
      findMany: async () => [],
    },
    company: {
      findUnique: async () => ({
        id: 'company-1',
        name: 'Employer',
        breakMinutes: 60,
        standardDailyHours: '8.00',
        billingProfile: {
          ico: '87654321',
          address: 'Brno',
          email: 'billing@example.com',
        },
      }),
    },
    user: {
      findUnique: async () => ({
        id: 'user-1',
        email: 'worker@example.com',
        phone: '',
        profile: {
          taxInformation: {
            businessName: 'Worker OSVC',
            ico: '12345678',
            address: 'Prague',
            iban: 'CZ6508000000192000145399',
            dueDays: 14,
            prefix: 'WT',
          },
        },
      }),
    },
    workEntry: {
      findMany: async () => entries,
    },
    invoice: {
      findFirst: async () => null,
    },
  };
}

test('approved payroll total matches invoice preview for the same work entries', async () => {
  const db = client();
  const payroll = await getManagerPayroll(db, managerContext(), {
    period: 'month',
    anchor: '2026-08-15',
  });
  const invoice = await previewInvoiceDraft(db, employeeContext(), { month: '2026-08' });

  assert.equal(payroll.summary.pendingHours, '0.00');
  assert.equal(payroll.summary.predictedSalaryCzk, '0.00');
  assert.equal(payroll.summary.approvedHours, invoice.totalHours);
  assert.equal(payroll.summary.confirmedSalaryCzk, invoice.subtotal);
});
