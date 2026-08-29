import { randomUUID } from 'node:crypto';

import { requireManager } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';

const CATEGORIES = new Set(['MATERIALS','TRANSPORT','FUEL','TOOLS','OFFICE','OTHER']);

function parseDate(value, fallback = new Date()) {
  const raw = String(value || '').trim() || fallback.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid expense date');
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error('Invalid expense date');
  return date;
}

function parseMonth(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid expense month');
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

function money(value) {
  const normalized = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > 10000000) throw new Error('Invalid expense amount');
  return normalized.toFixed(2);
}

function employeeName(membership) {
  if (!membership) return '';
  return [membership.user?.firstName, membership.user?.lastName].filter(Boolean).join(' ').trim()
    || membership.user?.name
    || membership.user?.email
    || '';
}

function serialize(row) {
  return {
    id: row.id,
    employeeMembershipId: row.employeeMembershipId || '',
    amountCzk: String(row.amountCzk),
    spentAt: row.spentAt.toISOString().slice(0, 10),
    category: row.category,
    note: row.note || '',
    createdAt: row.createdAt.toISOString(),
    employee: row.employeeMembership ? {
      id: row.employeeMembership.id,
      name: employeeName(row.employeeMembership),
      email: row.employeeMembership.user?.email || '',
    } : null,
  };
}

export async function handleExpenseRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/manager/expenses') {
    const context = await requireManager(request, response); if (!context) return true;
    const month = parseMonth(url.searchParams.get('month'));
    const category = String(url.searchParams.get('category') || '').trim().toUpperCase();
    const expenses = await runStoreRead({ prisma: client => client.companyExpense.findMany({
      where: {
        companyId: context.activeMembership.companyId,
        ...(month ? { spentAt: { gte: month.start, lt: month.end } } : {}),
        ...(category && CATEGORIES.has(category) ? { category } : {}),
      },
      include: { employeeMembership: { include: { user: true } } },
      orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
    }) });
    const totalCzk = expenses.reduce((sum, item) => sum + Number(item.amountCzk || 0), 0).toFixed(2);
    sendJson(response, 200, { expenses: expenses.map(serialize), summary: { totalCzk, count: expenses.length } });
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/manager/expenses') {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const employeeMembershipId = String(body?.employeeMembershipId || '').trim();
    const amountCzk = money(body?.amountCzk);
    const spentAt = parseDate(body?.spentAt);
    const category = String(body?.category || '').trim().toUpperCase();
    if (!CATEGORIES.has(category)) throw new Error('Invalid expense category');
    if (!employeeMembershipId) throw new Error('Employee is required');
    const note = String(body?.note || '').trim().slice(0, 500);
    const expense = await runStoreTransaction({ prisma: async client => {
      const employee = await client.companyMembership.findFirst({
        where: {
          id: employeeMembershipId,
          companyId: context.activeMembership.companyId,
          role: 'EMPLOYEE',
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
      if (!employee) throw new Error('Employee not found');
      return client.companyExpense.create({
        data: {
          id: randomUUID(),
          companyId: context.activeMembership.companyId,
          employeeMembershipId,
          managerMembershipId: context.activeMembership.id,
          amountCzk,
          spentAt,
          category,
          note: note || null,
        },
        include: { employeeMembership: { include: { user: true } } },
      });
    } });
    sendJson(response, 201, { expense: serialize(expense) });
    return true;
  }

  const match = pathName.match(/^\/api\/manager\/expenses\/([^/]+)$/);
  if (request.method === 'DELETE' && match) {
    const context = await requireManager(request, response); if (!context) return true;
    await runStoreTransaction({ prisma: async client => {
      const expense = await client.companyExpense.findFirst({ where: { id: match[1], companyId: context.activeMembership.companyId } });
      if (!expense) throw new Error('Expense not found');
      await client.companyExpense.delete({ where: { id: expense.id } });
    } });
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}
