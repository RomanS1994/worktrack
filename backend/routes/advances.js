import { randomUUID } from 'node:crypto';

import { requireEmployee, requireManager } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';

function parseDate(value, fallback = new Date()) {
  const raw = String(value || '').trim() || fallback.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('Invalid advance date');
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error('Invalid advance date');
  return date;
}

function parseMonth(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [year, month] = raw.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid advance month');
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function money(value) {
  const normalized = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized > 10000000) throw new Error('Invalid advance amount');
  return normalized.toFixed(2);
}

function serialize(row) {
  return {
    id: row.id,
    employeeMembershipId: row.employeeMembershipId,
    amountCzk: String(row.amountCzk),
    paidAt: row.paidAt.toISOString().slice(0, 10),
    note: row.note || '',
    createdAt: row.createdAt.toISOString(),
    employee: row.employeeMembership ? {
      id: row.employeeMembership.id,
      name: [row.employeeMembership.user?.firstName, row.employeeMembership.user?.lastName].filter(Boolean).join(' ').trim() || row.employeeMembership.user?.name || row.employeeMembership.user?.email || '',
      email: row.employeeMembership.user?.email || '',
    } : undefined,
  };
}

export async function handleAdvanceRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/manager/advances') {
    const context = await requireManager(request, response); if (!context) return true;
    const month = parseMonth(url.searchParams.get('month'));
    const payload = await runStoreRead({ prisma: async client => {
      const [employees, advances] = await Promise.all([
        client.companyMembership.findMany({
          where: { companyId: context.activeMembership.companyId, role: 'EMPLOYEE', status: 'ACTIVE', user: { is: { deletedAt: null } } },
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        }),
        client.salaryAdvance.findMany({
          where: {
            companyId: context.activeMembership.companyId,
            ...(month ? { paidAt: { gte: month.start, lt: month.end } } : {}),
          },
          include: { employeeMembership: { include: { user: true } } },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);
      return {
        employees: employees.map(m => ({
          id: m.id,
          name: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ').trim() || m.user?.name || m.user?.email || '',
          email: m.user?.email || '',
        })),
        advances: advances.map(serialize),
        summary: { totalCzk: advances.reduce((sum, item) => sum + Number(item.amountCzk || 0), 0).toFixed(2), count: advances.length },
      };
    } });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'POST' && pathName === '/api/manager/advances') {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const employeeMembershipId = String(body?.employeeMembershipId || '').trim();
    const amountCzk = money(body?.amountCzk);
    const paidAt = parseDate(body?.paidAt);
    const note = String(body?.note || '').trim().slice(0, 500);
    const advance = await runStoreTransaction({ prisma: async client => {
      const employee = await client.companyMembership.findFirst({ where: { id: employeeMembershipId, companyId: context.activeMembership.companyId, role: 'EMPLOYEE', status: 'ACTIVE' } });
      if (!employee) throw new Error('Employee not found');
      return client.salaryAdvance.create({
        data: { id: randomUUID(), companyId: context.activeMembership.companyId, employeeMembershipId, managerMembershipId: context.activeMembership.id, amountCzk, paidAt, note: note || null },
        include: { employeeMembership: { include: { user: true } } },
      });
    } });
    sendJson(response, 201, { advance: serialize(advance) }); return true;
  }

  const managerAdvanceMatch = pathName.match(/^\/api\/manager\/advances\/([^/]+)$/);
  if (request.method === 'DELETE' && managerAdvanceMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    await runStoreTransaction({ prisma: async client => {
      const advance = await client.salaryAdvance.findFirst({ where: { id: managerAdvanceMatch[1], companyId: context.activeMembership.companyId } });
      if (!advance) throw new Error('Advance not found');
      await client.salaryAdvance.delete({ where: { id: advance.id } });
    } });
    sendJson(response, 200, { ok: true }); return true;
  }

  if (request.method === 'GET' && pathName === '/api/advances') {
    const context = await requireEmployee(request, response); if (!context) return true;
    const month = parseMonth(url.searchParams.get('month'));
    const advances = await runStoreRead({ prisma: client => client.salaryAdvance.findMany({
      where: { employeeMembershipId: context.activeMembership.id, companyId: context.activeMembership.companyId, ...(month ? { paidAt: { gte: month.start, lt: month.end } } : {}) },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    }) });
    sendJson(response, 200, { advances: advances.map(serialize), summary: { totalCzk: advances.reduce((sum, item) => sum + Number(item.amountCzk || 0), 0).toFixed(2), count: advances.length } });
    return true;
  }

  return false;
}
