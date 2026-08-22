import { requireEmployee } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { getEmployeeMonthlyHours } from '../services/monthly-hours.js';

const ALLOWED_CURRENCIES = new Set(['CZK', 'EUR']);

function clean(value, maxLength = 180) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeTaxInformation(body = {}) {
  const dueDays = Math.min(90, Math.max(1, Number.parseInt(body.dueDays, 10) || 14));
  const currency = clean(body.currency, 3).toUpperCase();
  return {
    businessName: clean(body.businessName, 160),
    ico: clean(body.ico, 32),
    dic: clean(body.dic, 40),
    address: clean(body.address, 300),
    iban: clean(body.iban, 80),
    currency: ALLOWED_CURRENCIES.has(currency) ? currency : 'CZK',
    dueDays,
    prefix: clean(body.prefix, 16).toUpperCase() || 'WT',
  };
}

function readTaxInformation(user) {
  const profile = user?.profile && typeof user.profile === 'object' && !Array.isArray(user.profile) ? user.profile : {};
  return normalizeTaxInformation(profile.taxInformation || {});
}

export async function handleBillingRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/tax-information') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    sendJson(response, 200, { taxInformation: readTaxInformation(context.user) });
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/tax-information') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const taxInformation = normalizeTaxInformation(body);
    const updatedUser = await runStoreTransaction({
      prisma: async client => {
        const current = await client.user.findUnique({ where: { id: context.user.id }, select: { profile: true } });
        const profile = current?.profile && typeof current.profile === 'object' && !Array.isArray(current.profile) ? current.profile : {};
        return client.user.update({
          where: { id: context.user.id },
          data: { profile: { ...profile, taxInformation } },
          select: { id: true, profile: true, updatedAt: true },
        });
      },
    });
    sendJson(response, 200, { taxInformation, updatedAt: updatedUser.updatedAt });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/monthly-hours') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const payload = await runStoreRead({
      prisma: client => getEmployeeMonthlyHours(client, context, url.searchParams.get('month')),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/invoices') {
    const context = await requireEmployee(request, response);
    if (!context) return true;
    const invoices = await runStoreRead({
      prisma: client => client.auditLog.findMany({
        where: { actorUserId: context.user.id, entityType: 'INVOICE_DRAFT' },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
    });
    sendJson(response, 200, { invoices: invoices.map(item => ({ id: item.id, status: 'DRAFT', createdAt: item.createdAt, meta: item.meta || {} })) });
    return true;
  }

  return false;
}
