import assert from 'node:assert/strict';
import test from 'node:test';

import { createInvoiceDraft } from '../services/invoices.js';

function context(hourlyRateCzk = '350.00') {
  return {
    activeMembership: {
      id: 'employee-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk,
    },
  };
}

function baseClient(entries) {
  return {
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
    company: {
      findUnique: async () => ({
        id: 'company-1',
        name: 'Employer',
        billingProfile: { ico: '87654321', address: 'Brno', email: 'billing@example.com' },
        breakMinutes: 0,
        standardDailyHours: '8.00',
      }),
    },
    workEntry: {
      findMany: async () => entries,
    },
  };
}

function createdInvoice(args) {
  return {
    ...args.data,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    cancelledAt: null,
    items: args.data.items.create,
  };
}

test('invoice subtotal equals the sum of individually rounded line items', async () => {
  const entries = [
    {
      id: 'entry-1',
      workDate: new Date('2026-08-03T00:00:00.000Z'),
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      status: 'APPROVED',
      hours: '0.01',
      breakMinutes: 0,
      hourlyRateCzk: '0.50',
      project: { name: 'Project A' },
    },
    {
      id: 'entry-2',
      workDate: new Date('2026-08-04T00:00:00.000Z'),
      createdAt: new Date('2026-08-04T10:00:00.000Z'),
      status: 'APPROVED',
      hours: '0.01',
      breakMinutes: 0,
      hourlyRateCzk: '0.50',
      project: { name: 'Project B' },
    },
  ];
  const db = baseClient(entries);
  db.invoice = {
    findFirst: async () => null,
    create: async args => createdInvoice(args),
  };

  const invoice = await createInvoiceDraft(db, context('0.50'), { month: '2026-08' });

  assert.equal(invoice.items[0].amount, '0.01');
  assert.equal(invoice.items[1].amount, '0.01');
  assert.equal(invoice.subtotal, '0.02');
});

test('invoice creation retries with the next number after a concurrent number conflict', async () => {
  const entries = [
    {
      id: 'entry-1',
      workDate: new Date('2026-08-03T00:00:00.000Z'),
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      status: 'APPROVED',
      hours: '8.00',
      breakMinutes: 0,
      hourlyRateCzk: '200.00',
      project: { name: 'Project A' },
    },
  ];
  const db = baseClient(entries);
  let numberReads = 0;
  let createCalls = 0;
  db.invoice = {
    findFirst: async () => {
      numberReads += 1;
      return numberReads === 1 ? null : { invoiceNumber: 'WT-2026-0001' };
    },
    create: async args => {
      createCalls += 1;
      if (createCalls === 1) {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        error.meta = { target: ['companyId', 'invoiceNumber'] };
        throw error;
      }
      return createdInvoice(args);
    },
  };

  const invoice = await createInvoiceDraft(db, context(), { month: '2026-08' });

  assert.equal(createCalls, 2);
  assert.equal(invoice.invoiceNumber, 'WT-2026-0002');
});
