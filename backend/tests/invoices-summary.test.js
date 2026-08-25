import assert from 'node:assert/strict';
import test from 'node:test';

import { listEmployeeInvoices, listManagerInvoices } from '../services/invoices.js';

const BASE_INVOICE = {
  id: 'invoice-1',
  companyId: 'company-1',
  employeeMembershipId: 'employee-1',
  invoiceNumber: 'WT-2026-0001',
  periodStart: new Date('2026-08-01T00:00:00.000Z'),
  periodEnd: new Date('2026-08-31T00:00:00.000Z'),
  issueDate: new Date('2026-08-01T00:00:00.000Z'),
  dueDate: new Date('2999-08-15T00:00:00.000Z'),
  currency: 'CZK',
  hourlyRate: 300,
  totalHours: 10,
  subtotal: 3000,
  status: 'SENT',
  sellerSnapshot: { businessName: 'Worker', iban: 'CZ6508000000192000145399' },
  buyerSnapshot: { name: 'Company' },
  sentAt: new Date('2026-08-02T00:00:00.000Z'),
  viewedAt: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  items: [],
};

function employeeContext() {
  return {
    activeMembership: {
      id: 'employee-1',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  };
}

function managerContext() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

function employeeClient(invoices) {
  return {
    invoice: {
      findMany: async () => invoices,
    },
  };
}

function managerClient(invoices) {
  return {
    invoice: {
      findMany: async () => invoices.map(invoice => ({
        ...invoice,
        employeeMembership: {
          id: invoice.employeeMembershipId,
          user: { name: 'Employee One', email: 'employee@example.com' },
        },
      })),
    },
  };
}

test('employee invoice list returns stable summary and excludes cancelled amounts', async () => {
  const invoices = [
    { ...BASE_INVOICE, id: 'open', subtotal: 3000, status: 'SENT' },
    { ...BASE_INVOICE, id: 'paid', invoiceNumber: 'WT-2026-0002', subtotal: 4200, status: 'PAID', paidAt: new Date() },
    { ...BASE_INVOICE, id: 'cancelled', invoiceNumber: 'WT-2026-0003', subtotal: 9999, status: 'CANCELLED', cancelledAt: new Date() },
  ];

  const result = await listEmployeeInvoices(employeeClient(invoices), employeeContext());

  assert.equal(result.invoices.length, 3);
  assert.equal(result.summary.openAmount, '3000.00');
  assert.equal(result.summary.paidAmount, '4200.00');
  assert.equal(result.summary.cancelledCount, 1);
  assert.equal(result.summary.totalCount, 3);
});

test('overdue is derived only for unpaid sent or viewed invoices', async () => {
  const oldDueDate = new Date('2000-01-01T00:00:00.000Z');
  const invoices = [
    { ...BASE_INVOICE, id: 'overdue-sent', dueDate: oldDueDate, subtotal: 1000, status: 'SENT' },
    { ...BASE_INVOICE, id: 'overdue-viewed', invoiceNumber: 'WT-2026-0002', dueDate: oldDueDate, subtotal: 2000, status: 'VIEWED' },
    { ...BASE_INVOICE, id: 'paid-old', invoiceNumber: 'WT-2026-0003', dueDate: oldDueDate, subtotal: 3000, status: 'PAID', paidAt: new Date() },
    { ...BASE_INVOICE, id: 'cancelled-old', invoiceNumber: 'WT-2026-0004', dueDate: oldDueDate, subtotal: 4000, status: 'CANCELLED', cancelledAt: new Date() },
  ];

  const result = await listEmployeeInvoices(employeeClient(invoices), employeeContext());
  const byId = Object.fromEntries(result.invoices.map(invoice => [invoice.id, invoice]));

  assert.equal(byId['overdue-sent'].isOverdue, true);
  assert.equal(byId['overdue-viewed'].isOverdue, true);
  assert.equal(byId['paid-old'].isOverdue, false);
  assert.equal(byId['cancelled-old'].isOverdue, false);
  assert.equal(result.summary.overdueAmount, '3000.00');
  assert.equal(result.summary.overdueCount, 2);
});

test('manager invoice list keeps employee identity and the same financial summary contract', async () => {
  const invoices = [
    { ...BASE_INVOICE, id: 'open', subtotal: 1500, status: 'VIEWED', viewedAt: new Date() },
    { ...BASE_INVOICE, id: 'paid', invoiceNumber: 'WT-2026-0002', subtotal: 2500, status: 'PAID', paidAt: new Date() },
  ];

  const result = await listManagerInvoices(managerClient(invoices), managerContext());

  assert.equal(result.invoices[0].employee.id, 'employee-1');
  assert.equal(result.invoices[0].employee.name, 'Employee One');
  assert.equal(result.summary.openAmount, '1500.00');
  assert.equal(result.summary.paidAmount, '2500.00');
  assert.equal(result.summary.openCount, 1);
  assert.equal(result.summary.paidCount, 1);
});
