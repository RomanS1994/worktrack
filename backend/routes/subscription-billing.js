import { randomUUID } from 'node:crypto';
import { getAuthContext, requireManager } from '../auth/context.js';
import { prisma } from '../db/prisma.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendError, sendJson } from '../lib/http.js';

const PLANS = {
  TEAM_1_5: { name: 'Мала команда', min: 1, max: 5, price: 490 },
  TEAM_6_10: { name: 'Команда', min: 6, max: 10, price: 790 },
  TEAM_11_20: { name: 'Бригада', min: 11, max: 20, price: 1290 },
  TEAM_21_40: { name: 'Компанія', min: 21, max: 40, price: 2190 },
};
const planList = Object.entries(PLANS).map(([code, plan]) => ({ code, name: plan.name,
  employeeLimit: plan.max, minEmployees: plan.min, monthlyPriceCzk: plan.price }));
const PAYMENT_SELECT = {
  id: true, companyId: true, invoiceNumber: true, planCode: true,
  employeeLimit: true, amountCzk: true, currency: true, variableSymbol: true,
  periodStart: true, periodEnd: true, dueDate: true, status: true,
  reviewRequestedAt: true, paidAt: true, rejectedAt: true,
  reviewedByEmail: true, createdAt: true,
};

function adminEmails() {
  return String(process.env.SUBSCRIPTION_ADMIN_EMAILS || '').split(',')
    .map(value => value.trim().toLowerCase()).filter(Boolean);
}

function isSubscriptionAdmin(email) {
  return adminEmails().includes(String(email || '').trim().toLowerCase());
}

async function requirePlatformAdmin(request, response) {
  const context = await getAuthContext(request, response);
  if (!context) return null;
  if (!isSubscriptionAdmin(context.user.email)) {
    sendError(response, 403, 'Platform subscription administrator access is required');
    return null;
  }
  return context;
}

function accountDetails() {
  const accountNumber = String(process.env.SUBSCRIPTION_ACCOUNT_NUMBER || '').trim();
  const bankCode = String(process.env.SUBSCRIPTION_BANK_CODE || '').trim();
  const prefix = String(process.env.SUBSCRIPTION_ACCOUNT_PREFIX || '').trim();
  const holder = String(process.env.SUBSCRIPTION_ACCOUNT_HOLDER || '').trim();
  const configured = Boolean(accountNumber && bankCode);
  const account = configured ? `${prefix ? `${prefix}-` : ''}${accountNumber}/${bankCode}` : '';
  return { accountConfigured: configured, account, holder };
}

function spaydFor(payment) {
  const details = accountDetails();
  if (!details.accountConfigured) return null;
  const [localAccount, bankCode] = details.account.split('/');
  const [prefix, number] = localAccount.includes('-') ? localAccount.split('-', 2) : ['', localAccount];
  const fields = [
    'SPD*1.0',
    `ACC:${prefix ? `${prefix}-` : ''}${number}/${bankCode}`,
    `AM:${Number(payment.amountCzk).toFixed(2)}`,
    'CC:CZK',
    `X-VS:${payment.variableSymbol}`,
    `MSG:WorkTrack ${payment.invoiceNumber}`,
    `DT:${payment.dueDate.toISOString().slice(0, 10).replaceAll('-', '')}`,
  ];
  if (details.holder) fields.push(`RN:${details.holder.replaceAll('*', ' ')}`);
  return fields.join('*');
}

function addMonth(date) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function invoiceNumber(now) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `WT-SUB-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function variableSymbol() {
  const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `${Date.now().toString().slice(-4)}${suffix}`;
}

function paymentResponse(payment) {
  return {
    payment,
    accountConfigured: accountDetails().accountConfigured,
    bankDetails: accountDetails(),
    spayd: spaydFor(payment),
  };
}

function currentSubStatus(subscription, now = new Date()) {
  if (!subscription?.currentPeriodEnd) return 'INACTIVE';
  if (subscription.currentPeriodEnd > now) return 'ACTIVE';
  if (subscription.gracePeriodEnd > now) return 'GRACE_PERIOD';
  return 'EXPIRED';
}

function serializeInvoice(payment) {
  const details = accountDetails();
  return { ...payment, dueAt: payment.dueDate, qrPayload: spaydFor(payment),
    accountNumber: process.env.SUBSCRIPTION_ACCOUNT_NUMBER || '',
    bankCode: process.env.SUBSCRIPTION_BANK_CODE || '',
    accountPrefix: process.env.SUBSCRIPTION_ACCOUNT_PREFIX || '',
    accountHolder: details.holder };
}

export async function handleSubscriptionBillingRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/company-subscription') {
    const context = await requireManager(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: async client => {
      const companyId = context.activeMembership.companyId;
      const [subscription, activeEmployeeCount, payments] = await Promise.all([
        client.companySubscription.findUnique({ where: { companyId } }),
        client.companyMembership.count({ where: { companyId, role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null } }),
        client.subscriptionPayment.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 24, select: PAYMENT_SELECT }),
      ]);
      return { subscription: subscription ? { ...subscription, plan: PLANS[subscription.planCode]?.name || subscription.planCode,
        status: currentSubStatus(subscription) } : null,
        employeeCount: activeEmployeeCount, activeEmployeeCount, plans: planList,
        accountConfigured: accountDetails().accountConfigured, invoices: payments.map(serializeInvoice), payments: payments.map(serializeInvoice) };
    } });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'POST' && pathName === '/api/company-subscription/invoices') {
    const context = await requireManager(request, response);
    if (!context) return true;
    if (!accountDetails().accountConfigured) {
      sendError(response, 503, 'Subscription bank account is not configured');
      return true;
    }
    if (!accountDetails().accountConfigured) {
      sendError(response, 503, 'Subscription bank account is not configured yet');
      return true;
    }
    const body = await readJsonBody(request);
    const plan = PLANS[String(body.planCode || '')];
    if (!plan) { sendError(response, 400, 'Unsupported subscription plan'); return true; }
    const now = new Date();
    const created = await runStoreTransaction({ prisma: async tx => {
      const companyId = context.activeMembership.companyId;
      const activeEmployeeCount = await tx.companyMembership.count({ where: { companyId, role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null } });
      if (activeEmployeeCount > plan.max) {
        const error = new Error(`This plan supports up to ${plan.max} active employees; company currently has ${activeEmployeeCount}`);
        error.statusCode = 400; throw error;
      }
      const outstanding = await tx.subscriptionPayment.findFirst({ where: { companyId, status: { in: ['PENDING', 'REVIEW_REQUESTED'] } }, select: { id: true } });
      if (outstanding) { const error = new Error('An unpaid subscription invoice already exists'); error.statusCode = 409; throw error; }
      const subscription = await tx.companySubscription.findUnique({ where: { companyId } });
      const periodStart = subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
      const periodEnd = addMonth(periodStart);
      const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + 14);
      return tx.subscriptionPayment.create({ data: {
        id: randomUUID(), companyId, invoiceNumber: invoiceNumber(now), planCode: body.planCode,
        employeeLimit: plan.max, amountCzk: plan.price, variableSymbol: variableSymbol(),
        periodStart, periodEnd, dueDate, status: 'PENDING',
      }, select: PAYMENT_SELECT });
    } });
    sendJson(response, 201, { ...paymentResponse(created), invoice: serializeInvoice(created) }); return true;
  }

  const reviewMatch = pathName.match(/^\/api\/company-subscription\/invoices\/([^/]+)\/request-review$/);
  if (request.method === 'POST' && reviewMatch) {
    const context = await requireManager(request, response);
    if (!context) return true;
    const updated = await runStoreTransaction({ prisma: async tx => {
      const payment = await tx.subscriptionPayment.findFirst({ where: { id: decodeURIComponent(reviewMatch[1]), companyId: context.activeMembership.companyId } });
      if (!payment) { const error = new Error('Subscription invoice not found'); error.statusCode = 404; throw error; }
      if (payment.status === 'REVIEW_REQUESTED') return payment;
      if (payment.status !== 'PENDING') { const error = new Error('This invoice cannot be submitted for review'); error.statusCode = 409; throw error; }
      return tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'REVIEW_REQUESTED', reviewRequestedAt: new Date() }, select: PAYMENT_SELECT });
    } });
    sendJson(response, 200, { ...paymentResponse(updated), invoice: serializeInvoice(updated) }); return true;
  }

  if (request.method === 'GET' && pathName === '/api/platform/subscription-payments') {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const status = request.url ? new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('status') : null;
    const where = status && ['PENDING', 'REVIEW_REQUESTED', 'PAID', 'REJECTED', 'OVERDUE'].includes(status) ? { status } : {};
    const rows = await runStoreRead({ prisma: client => client.subscriptionPayment.findMany({ where, include: { company: { select: { id: true, name: true, memberships: { where: { role: 'MANAGER', status: 'ACTIVE', deletedAt: null }, take: 1, include: { user: { select: { name: true, email: true } } } } } } }, orderBy: { createdAt: 'desc' }, take: 100 }) });
    const payments = rows.map(({ company, ...payment }) => ({
      id: payment.id,
      company: { name: company.name },
      planCode: payment.planCode,
      amountCzk: payment.amountCzk,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      dueAt: payment.dueDate,
      variableSymbol: payment.variableSymbol,
      status: payment.status,
      managerName: company.memberships[0]?.user?.name || '',
      managerEmail: company.memberships[0]?.user?.email || '',
    }));
    sendJson(response, 200, { payments }); return true;
  }

  const adminMatch = pathName.match(/^\/api\/platform\/subscription-payments\/([^/]+)\/(confirm|reject)$/);
  if (request.method === 'POST' && adminMatch) {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const paymentId = decodeURIComponent(adminMatch[1]);
    const action = adminMatch[2];
    const result = await runStoreTransaction({ prisma: async tx => {
      const payment = await tx.subscriptionPayment.findUnique({ where: { id: paymentId } });
      if (!payment) { const error = new Error('Subscription payment not found'); error.statusCode = 404; throw error; }
      if (payment.status === 'PAID') { const error = new Error('Payment has already been confirmed'); error.statusCode = 409; throw error; }
      if (payment.status !== 'REVIEW_REQUESTED' && payment.status !== 'PENDING') { const error = new Error('Payment is not awaiting review'); error.statusCode = 409; throw error; }
      const paidAt = new Date();
      const claimed = await tx.subscriptionPayment.updateMany({
        where: { id: paymentId, status: { in: ['REVIEW_REQUESTED', 'PENDING'] } },
        data: action === 'reject'
          ? { status: 'REJECTED', rejectedAt: new Date(), reviewedByEmail: context.user.email }
          : { status: 'PAID', paidAt, reviewedByEmail: context.user.email },
      });
      if (claimed.count !== 1) {
        const error = new Error(action === 'confirm' ? 'Payment has already been confirmed' : 'Payment is not awaiting review');
        error.statusCode = 409;
        throw error;
      }
      if (action === 'reject') {
        return tx.subscriptionPayment.findUnique({ where: { id: paymentId }, select: PAYMENT_SELECT });
      }
      const subscription = await tx.companySubscription.findUnique({ where: { companyId: payment.companyId } });
      const currentEnd = subscription?.currentPeriodEnd && subscription.currentPeriodEnd > paidAt ? subscription.currentPeriodEnd : paidAt;
      const start = currentEnd;
      const periodStart = payment.periodStart > start ? payment.periodStart : start;
      const periodEnd = addMonth(periodStart);
      const confirmed = await tx.subscriptionPayment.update({ where: { id: paymentId }, data: {
        status: 'PAID', paidAt, reviewedByEmail: context.user.email, periodStart, periodEnd,
      }, select: PAYMENT_SELECT });
      await tx.companySubscription.upsert({ where: { companyId: payment.companyId }, create: {
        id: randomUUID(), companyId: payment.companyId, planCode: payment.planCode, employeeLimit: payment.employeeLimit,
        monthlyPriceCzk: payment.amountCzk, status: 'ACTIVE', currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd, gracePeriodEnd: new Date(periodEnd.getTime() + 5 * 86400000),
      }, update: { planCode: payment.planCode, employeeLimit: payment.employeeLimit, monthlyPriceCzk: payment.amountCzk,
        status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
        gracePeriodEnd: new Date(periodEnd.getTime() + 5 * 86400000) } });
      return confirmed;
    } });
    sendJson(response, 200, { payment: result }); return true;
  }

  return false;
}
