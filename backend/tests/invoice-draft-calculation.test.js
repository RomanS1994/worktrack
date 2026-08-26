import assert from 'node:assert/strict';
import test from 'node:test';

import { createInvoiceDraft, previewInvoiceDraft } from '../services/invoices.js';

function context() {
  return {
    activeMembership: {
      id: 'employee-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '350.00',
    },
  };
}

function client() {
  let createdPayload = null;
  return {
    get createdPayload() { return createdPayload; },
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
        breakMinutes: 60,
        standardDailyHours: '8.00',
      }),
    },
    workEntry: {
      findMany: async () => [
        {
          id: 'entry-1',
          workDate: new Date('2026-08-03T00:00:00.000Z'),
          createdAt: new Date('2026-08-03T10:00:00.000Z'),
          status: 'APPROVED',
          hours: '8.00',
          grossHours: null,
          breakMinutes: 60,
          hourlyRateCzk: '200.00',
          project: { name: 'Project A' },
        },
        {
          id: 'entry-2',
          workDate: new Date('2026-08-04T00:00:00.000Z'),
          createdAt: new Date('2026-08-04T10:00:00.000Z'),
          status: 'APPROVED',
          hours: '8.00',
          grossHours: null,
          breakMinutes: 60,
          hourlyRateCzk: '300.00',
          project: { name: 'Project B' },
        },
      ],
    },
    invoice: {
      findFirst: async () => null,
      create: async args => {
        createdPayload = args.data;
        return {
          ...args.data,
          createdAt: new Date('2026-08-31T00:00:00.000Z'),
          sentAt: null,
          viewedAt: null,
          paidAt: null,
          cancelledAt: null,
          items: args.data.items.create,
        };
      },
    },
  };
}

test('invoice preview uses daily net hours and work-entry rate snapshots', async () => {
  const db = client();
  const preview = await previewInvoiceDraft(db, context(), { month: '2026-08' });

  assert.equal(preview.totalHours, '14.00');
  assert.equal(preview.subtotal, '3500.00');
  assert.equal(preview.hourlyRate, '250.00');
  assert.equal(preview.itemsCount, 2);
});

test('invoice items preserve each entry rate instead of current membership rate', async () => {
  const db = client();
  const invoice = await createInvoiceDraft(db, context(), { month: '2026-08' });

  assert.equal(invoice.totalHours, '14.00');
  assert.equal(invoice.subtotal, '3500.00');
  assert.equal(invoice.items[0].hours, '7.00');
  assert.equal(invoice.items[0].hourlyRate, '200.00');
  assert.equal(invoice.items[0].amount, '1400.00');
  assert.equal(invoice.items[1].hours, '7.00');
  assert.equal(invoice.items[1].hourlyRate, '300.00');
  assert.equal(invoice.items[1].amount, '2100.00');
  assert.equal(db.createdPayload.hourlyRate, '250.00');
});
