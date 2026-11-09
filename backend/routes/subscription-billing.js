import { randomUUID } from 'node:crypto';
import { getAuthContext, requireManager } from '../auth/context.js';
import { prisma } from '../db/prisma.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendError, sendJson } from '../lib/http.js';
import { createAuditLog } from '../db/prisma-helpers.js';

import { SUBSCRIPTION_PLANS as PLANS, subscriptionPlanList as planList, applyScheduledCompanyPlan, lockCompanyForSeatChange } from '../services/subscription-plans.js';
const ANNUAL_TERM_MONTHS = 12;
const ANNUAL_DISCOUNT_PERCENT = 20;
const ANNUAL_BILLING_FACTOR = (100 - ANNUAL_DISCOUNT_PERCENT) / 100;
const PAYMENT_SELECT = {
  id: true, companyId: true, invoiceNumber: true, planCode: true,
  employeeLimit: true, amountCzk: true, currency: true, variableSymbol: true,
  periodStart: true, periodEnd: true, dueDate: true, status: true,
  reviewRequestedAt: true, paidAt: true, rejectedAt: true,
  reviewedByEmail: true, createdAt: true, changeType: true, billingPeriod: true,
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

function czechIban(accountNumber, bankCode, prefix = '') {
  const account = String(accountNumber || '');
  const bank = String(bankCode || '');
  const accountPrefix = String(prefix || '');
  if (!/^\d{1,10}$/.test(account) || !/^\d{4}$/.test(bank) || (accountPrefix && !/^\d{1,6}$/.test(accountPrefix))) return null;

  const bban = `${bank}${accountPrefix.padStart(6, '0')}${account.padStart(10, '0')}`;
  const rearranged = `${bban}123500`;
  let remainder = 0;
  for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
  return `CZ${String(98 - remainder).padStart(2, '0')}${bban}`;
}

function spaydFor(payment) {
  const details = accountDetails();
  if (!details.accountConfigured) return null;
  const [localAccount, bankCode] = details.account.split('/');
  const [prefix, number] = localAccount.includes('-') ? localAccount.split('-', 2) : ['', localAccount];
  const iban = czechIban(number, bankCode, prefix);
  if (!iban) return null;
  const fields = [
    'SPD*1.0',
    `ACC:${iban}`,
    `AM:${Number(payment.amountCzk).toFixed(2)}`,
    'CC:CZK',
    `X-VS:${payment.variableSymbol}`,
    `MSG:WorkTrack ${payment.invoiceNumber}`,
    `DT:${payment.dueDate.toISOString().slice(0, 10).replaceAll('-', '')}`,
  ];
  if (details.holder) fields.push(`RN:${details.holder.replaceAll('*', ' ')}`);
  return fields.join('*');
}

function addMonths(date, months = 1) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function addMonth(date) {
  return addMonths(date, 1);
}

function monthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
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

function clearScheduledPlanChange() {
  return {
    scheduledPlanCode: null, scheduledEmployeeLimit: null, scheduledMonthlyPriceCzk: null,
    scheduledBillingPeriod: null, scheduledEffectiveAt: null, scheduledPeriodEnd: null,
  };
}

function currentSubStatus(subscription, now = new Date()) {
  if (subscription?.status === 'INACTIVE') return 'INACTIVE';
  if (!subscription?.currentPeriodEnd) return 'INACTIVE';
  if (subscription.trialEndsAt && subscription.trialEndsAt > now) return 'TRIAL';
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
  // Separate platform cabinet APIs. These expose only operational company data;
  // employee rates, contact details, profiles and timesheets are deliberately omitted.
  if (request.method === 'GET' && pathName === '/api/platform/admin/overview') {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const overview = await runStoreRead({ prisma: async client => {
      const [companies, pendingPaymentReviewsCount, overduePayments] = await Promise.all([client.company.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, createdAt: true,
          subscription: { select: { planCode: true, employeeLimit: true, status: true, currentPeriodEnd: true, trialEndsAt: true } },
          memberships: { where: { status: 'ACTIVE', deletedAt: null }, select: { role: true } } },
      }), client.subscriptionPayment.count({ where: { status: 'REVIEW_REQUESTED' } }),
      client.subscriptionPayment.findMany({ where: { status: 'OVERDUE' }, select: { companyId: true } })]);
      const items = companies.map(company => {
        const employees = company.memberships.filter(m => m.role === 'EMPLOYEE').length;
        const managers = company.memberships.filter(m => m.role === 'MANAGER').length;
        return { id: company.id, name: company.name, createdAt: company.createdAt,
          employeeCount: employees, managerCount: managers, subscription: company.subscription };
      });
      const now = new Date();
      const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      const [companyHistory, employeeHistory] = await Promise.all([
        client.company.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
        client.companyMembership.findMany({ where: { role: 'EMPLOYEE', createdAt: { gte: trendStart } }, select: { createdAt: true } }),
      ]);
      const trends = Array.from({ length: 6 }, (_, offset) => {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + offset, 1));
        const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
        const inMonth = value => value >= date && value < nextMonth;
        return {
          month: date.toISOString().slice(0, 7),
          companiesCreated: companyHistory.filter(row => inMonth(row.createdAt)).length,
          employeesAdded: employeeHistory.filter(row => inMonth(row.createdAt)).length,
        };
      });
      const overdueIds = new Set(overduePayments.map(row => row.companyId));
      return { companiesCount: items.length,
        activeSubscriptionsCount: items.filter(c => c.subscription && currentSubStatus(c.subscription, now) === 'ACTIVE').length,
        trialCompaniesCount: items.filter(c => c.subscription && currentSubStatus(c.subscription, now) === 'TRIAL').length,
        overdueCompaniesCount: items.filter(c => overdueIds.has(c.id) || (c.subscription && ['EXPIRED', 'GRACE_PERIOD'].includes(currentSubStatus(c.subscription, now)))).length,
        activeEmployeesCount: items.reduce((n, c) => n + c.employeeCount, 0), pendingPaymentReviewsCount, trends };
    } });
    sendJson(response, 200, overview); return true;
  }

  if (request.method === 'GET' && pathName === '/api/platform/admin/companies') {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const search = (url.searchParams.get('search') || '').trim().toLocaleLowerCase();
    const companies = await runStoreRead({ prisma: async client => {
      const [rows, overduePayments] = await Promise.all([
        client.company.findMany({ orderBy: { createdAt: 'desc' }, select: {
          id: true, name: true, subscription: { select: { planCode: true, status: true, currentPeriodEnd: true, trialEndsAt: true } },
          memberships: { where: { status: 'ACTIVE', deletedAt: null }, select: { role: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        } }),
        client.subscriptionPayment.findMany({ where: { status: 'OVERDUE' }, select: { companyId: true } }),
      ]);
      const overdueCompanyIds = new Set(overduePayments.map(payment => payment.companyId));
      return rows.map(company => {
        const manager = company.memberships.find(m => m.role === 'MANAGER')?.user;
        return { id: company.id, name: company.name, managerName: manager?.name || '', managerEmail: manager?.email || '',
          activeEmployees: company.memberships.filter(m => m.role === 'EMPLOYEE').length,
          planCode: company.subscription?.planCode || '', subscriptionStatus: company.subscription ? currentSubStatus(company.subscription) : 'INACTIVE',
          hasOverduePayment: overdueCompanyIds.has(company.id),
          trialEndsAt: company.subscription?.trialEndsAt || null, currentPeriodEnd: company.subscription?.currentPeriodEnd || null,
          _search: `${company.name} ${manager?.name || ''} ${manager?.email || ''}`.toLocaleLowerCase() };
      }).filter(company => !search || company._search.includes(search)).map(({ _search, ...company }) => company);
    } });
    sendJson(response, 200, { companies }); return true;
  }

  const deleteCompanyMatch = pathName.match(/^\/api\/platform\/admin\/companies\/([^/]+)$/);
  if (request.method === 'DELETE' && deleteCompanyMatch) {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const companyId = decodeURIComponent(deleteCompanyMatch[1]);
    const deleted = await runStoreTransaction({ prisma: async tx => {
      const company = await tx.company.findUnique({ where: { id: companyId }, include: {
        subscription: { select: { companyId: true } },
        memberships: { select: { role: true, user: { select: { name: true } } } },
        _count: { select: { projects: true, workEntries: true, weeklySubmissions: true, notifications: true,
          invoices: true, subscriptionPayments: true, managerTimesheetEntries: true, salaryAdvances: true,
          expenses: true, chatAttachments: true } },
      } });
      if (!company) { const error = new Error('Company not found'); error.statusCode = 404; throw error; }
      const isNamedTestCompany = /^Codex (?:Audit|Payload|Final|Compact) \d{13}$/.test(company.name);
      const hasOnlyCodexManagers = company.memberships.length > 0
        && company.memberships.every(membership => membership.role === 'MANAGER' && /^Codex\b/i.test(membership.user?.name || ''));
      if (!isNamedTestCompany || !hasOnlyCodexManagers) {
        const error = new Error('Test company is not eligible for deletion');
        error.statusCode = 409; throw error;
      }
      const blockers = [
        ...(company.subscription ? [{ key: 'subscription', count: 1 }] : []),
        ...[
          ['employees', company.memberships.filter(membership => membership.role === 'EMPLOYEE').length],
          ['payments', company._count.subscriptionPayments],
          ['workEntries', company._count.workEntries],
          ['weeklySubmissions', company._count.weeklySubmissions],
          ['invoices', company._count.invoices],
          ['managerTimesheetEntries', company._count.managerTimesheetEntries],
          ['salaryAdvances', company._count.salaryAdvances],
          ['expenses', company._count.expenses],
          ['chatAttachments', company._count.chatAttachments],
        ].filter(([, count]) => count > 0).map(([key, count]) => ({ key, count })),
      ];
      if (blockers.length) {
        const error = new Error('Test company contains business data and cannot be deleted');
        error.statusCode = 409;
        error.code = 'TEST_COMPANY_HAS_DATA';
        error.details = { blockers };
        throw error;
      }
      await createAuditLog(tx, { action: 'platform.test_company_deleted', actorUserId: context.user.id,
        entityType: 'company', entityId: company.id,
        before: { name: company.name, createdAt: company.createdAt.toISOString(),
          removedEmptyProjects: company._count.projects, removedNotifications: company._count.notifications },
        after: null, meta: { actorEmail: context.user.email, source: 'platform_admin_cabinet', at: new Date().toISOString() } });
      await tx.company.delete({ where: { id: company.id } });
      return { id: company.id, name: company.name };
    } });
    sendJson(response, 200, { deleted: true, company: deleted }); return true;
  }

  const companyMatch = pathName.match(/^\/api\/platform\/admin\/companies\/([^/]+)$/);
  if (request.method === 'GET' && companyMatch) {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const company = await runStoreRead({ prisma: client => client.company.findUnique({
      where: { id: decodeURIComponent(companyMatch[1]) },
      select: { id: true, name: true, slug: true, createdAt: true,
        subscription: true,
        memberships: { where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, role: true, status: true, createdAt: true, user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } } },
    }) });
    if (!company) { sendError(response, 404, 'Company not found'); return true; }
    sendJson(response, 200, { company: { ...company, memberships: company.memberships.map(({ user, ...membership }) => ({ ...membership, displayName: user.name })) } }); return true;
  }

  const subscriptionMatch = pathName.match(/^\/api\/platform\/admin\/companies\/([^/]+)\/subscription$/);
  if (request.method === 'PATCH' && subscriptionMatch) {
    const context = await requirePlatformAdmin(request, response);
    if (!context) return true;
    const companyId = decodeURIComponent(subscriptionMatch[1]);
    const body = await readJsonBody(request);
    const plan = body.planCode == null ? null : PLANS[String(body.planCode)];
    if (body.planCode != null && !plan) { sendError(response, 400, 'Unsupported subscription plan'); return true; }
    if (body.status != null && !['ACTIVE', 'INACTIVE'].includes(String(body.status))) { sendError(response, 400, 'Status must be ACTIVE or INACTIVE'); return true; }
    const result = await runStoreTransaction({ prisma: async tx => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) { const error = new Error('Company not found'); error.statusCode = 404; throw error; }
      const before = await tx.companySubscription.findUnique({ where: { companyId } });
      const now = new Date();
      const activeStart = before?.currentPeriodEnd && before.currentPeriodEnd > now ? before.currentPeriodEnd : now;
      const activeEnd = body.status === 'ACTIVE' ? addMonth(activeStart) : undefined;
      const data = { ...(plan ? { planCode: body.planCode, employeeLimit: plan.max, monthlyPriceCzk: plan.price } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.status === 'ACTIVE' ? { currentPeriodStart: activeStart, currentPeriodEnd: activeEnd, gracePeriodEnd: new Date(activeEnd.getTime() + 5 * 86400000), trialEndsAt: null } : {}) };
      const defaultPlan = PLANS.TEAM_1_5;
      const after = await tx.companySubscription.upsert({ where: { companyId },
        create: { id: randomUUID(), companyId, planCode: plan ? body.planCode : defaultPlan.code, employeeLimit: plan?.max || defaultPlan.max, monthlyPriceCzk: plan?.price || defaultPlan.price, status: body.status || 'INACTIVE', ...data },
        update: data });
      await createAuditLog(tx, { action: 'platform.subscription_updated', actorUserId: context.user.id,
        entityType: 'company_subscription', entityId: companyId,
        before: before ? { planCode: before.planCode, employeeLimit: before.employeeLimit, status: before.status } : null,
        after: { planCode: after.planCode, employeeLimit: after.employeeLimit, status: after.status },
        meta: { actorEmail: context.user.email, source: 'platform_admin_cabinet', at: now.toISOString() } });
      return after;
    } });
    sendJson(response, 200, { subscription: result }); return true;
  }

  if (request.method === 'GET' && pathName === '/api/company-subscription') {
    const context = await requireManager(request, response);
    if (!context) return true;
    const payload = await runStoreTransaction({ prisma: async client => {
      const companyId = context.activeMembership.companyId;
      const subscription = await applyScheduledCompanyPlan(client, companyId);
      const [activeEmployeeCount, payments] = await Promise.all([
        client.companyMembership.count({ where: { companyId, role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null } }),
        client.subscriptionPayment.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 24, select: PAYMENT_SELECT }),
      ]);
      return { subscription: subscription ? { ...subscription, plan: PLANS[subscription.planCode]?.name || subscription.planCode,
        status: currentSubStatus(subscription), isTrial: Boolean(subscription.trialEndsAt && subscription.trialEndsAt > new Date()), trialEndsAt: subscription.trialEndsAt, daysRemaining: subscription.trialEndsAt && subscription.trialEndsAt > new Date() ? Math.ceil((subscription.trialEndsAt - new Date()) / 86400000) : 0 } : null,
        employeeCount: activeEmployeeCount, activeEmployeeCount, plans: planList.map(plan => ({ ...plan, annualPriceCzk: Math.round(plan.monthlyPriceCzk * ANNUAL_TERM_MONTHS * ANNUAL_BILLING_FACTOR), annualMonthlyPriceCzk: Math.round(plan.monthlyPriceCzk * ANNUAL_BILLING_FACTOR), annualSavingsCzk: Math.round(plan.monthlyPriceCzk * ANNUAL_TERM_MONTHS * (1 - ANNUAL_BILLING_FACTOR)) })),
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
    const body = await readJsonBody(request);
    const plan = PLANS[String(body.planCode || '')];
    if (!plan) { sendError(response, 400, 'Unsupported subscription plan'); return true; }
    const billingPeriod = String(body.billingPeriod || 'month');
    if (!['month', 'year'].includes(billingPeriod)) { sendError(response, 400, 'Unsupported subscription billing period'); return true; }
    const now = new Date();
    const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + 14);
    const created = await runStoreTransaction({ prisma: async tx => {
      const companyId = context.activeMembership.companyId;
      await lockCompanyForSeatChange(tx, companyId);
      const subscription = await applyScheduledCompanyPlan(tx, companyId, now);
      const activeEmployeeCount = await tx.companyMembership.count({ where: { companyId, role: 'EMPLOYEE', status: 'ACTIVE', deletedAt: null } });
      if (activeEmployeeCount > plan.max) {
        const error = new Error(`Plan supports up to ${plan.max} active employees; the company currently has ${activeEmployeeCount}`);
        error.statusCode = 400; throw error;
      }
      const outstanding = await tx.subscriptionPayment.findFirst({ where: { companyId, status: { in: ['PENDING', 'REVIEW_REQUESTED'] } }, select: { id: true } });
      if (outstanding) { const error = new Error('An unpaid subscription invoice already exists'); error.statusCode = 409; throw error; }
      if (subscription?.scheduledEffectiveAt) {
        const error = new Error('A plan change is already scheduled'); error.statusCode = 409; throw error;
      }

      const subscriptionActive = Boolean(subscription?.currentPeriodEnd && subscription.currentPeriodEnd > now
        && ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'].includes(currentSubStatus(subscription, now)));
      const currentLimit = subscription?.employeeLimit || 0;
      const isGrowth = subscriptionActive && plan.max > currentLimit;
      const sameBillingPeriod = (subscription?.billingPeriod || 'month') === billingPeriod;
      const isImmediateUpgrade = isGrowth && sameBillingPeriod && currentSubStatus(subscription, now) === 'ACTIVE';
      const changeType = isImmediateUpgrade ? 'UPGRADE' : (subscriptionActive ? (plan.max < currentLimit ? 'DOWNGRADE' : 'RENEWAL') : 'RENEWAL');
      const periodMonths = billingPeriod === 'year' ? ANNUAL_TERM_MONTHS : 1;
      let periodStart;
      let periodEnd;
      let amountCzk = Math.round(plan.price * (billingPeriod === 'year' ? ANNUAL_TERM_MONTHS * ANNUAL_BILLING_FACTOR : 1));

      if (isImmediateUpgrade) {
        const currentStart = subscription.currentPeriodStart || now;
        const currentEnd = subscription.currentPeriodEnd;
        const remaining = Math.max(0, currentEnd.getTime() - now.getTime());
        const duration = Math.max(1, currentEnd.getTime() - currentStart.getTime());
        const factor = billingPeriod === 'year' ? ANNUAL_BILLING_FACTOR : 1;
        const currentMonthly = Number(subscription.monthlyPriceCzk || 0) * factor;
        const upgradedMonthly = plan.price * factor;
        amountCzk = Math.max(1, Math.round((upgradedMonthly - currentMonthly) * remaining / duration));
        periodStart = now;
        periodEnd = currentEnd;
      } else {
        periodStart = subscriptionActive ? subscription.currentPeriodEnd : now;
        periodEnd = addMonths(periodStart, periodMonths);
      }

      return tx.subscriptionPayment.create({ data: {
        id: randomUUID(), companyId, invoiceNumber: invoiceNumber(now), planCode: body.planCode,
        employeeLimit: plan.max, changeType, billingPeriod, amountCzk, variableSymbol: variableSymbol(),
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
    const rows = await runStoreRead({ prisma: client => client.subscriptionPayment.findMany({ where, include: { company: { select: { id: true, name: true, memberships: { where: { role: 'MANAGER', status: 'ACTIVE', deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 1, include: { user: { select: { name: true, email: true } } } } } } }, orderBy: { createdAt: 'desc' }, take: 100 }) });
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
      const monthlyPriceCzk = PLANS[payment.planCode]?.price || payment.amountCzk;
      const currentPeriodStillActive = Boolean(subscription?.currentPeriodEnd && subscription.currentPeriodEnd > paidAt
        && ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'].includes(currentSubStatus(subscription, paidAt)));
      const isScheduled = currentPeriodStillActive && payment.changeType !== 'UPGRADE'
        && payment.periodStart > paidAt;
      const termMonths = payment.billingPeriod === 'year' ? ANNUAL_TERM_MONTHS : 1;
      const periodStart = isScheduled ? payment.periodStart : (payment.periodStart > paidAt && !subscription ? payment.periodStart : paidAt);
      const periodEnd = isScheduled ? payment.periodEnd : (payment.changeType === 'UPGRADE' && currentPeriodStillActive
        ? subscription.currentPeriodEnd : addMonths(periodStart, termMonths));
      const confirmed = await tx.subscriptionPayment.update({ where: { id: paymentId }, data: {
        status: 'PAID', paidAt, reviewedByEmail: context.user.email, periodStart, periodEnd,
      }, select: PAYMENT_SELECT });

      if (isScheduled) {
        await tx.companySubscription.update({ where: { companyId: payment.companyId }, data: {
          scheduledPlanCode: payment.planCode, scheduledEmployeeLimit: payment.employeeLimit,
          scheduledMonthlyPriceCzk: monthlyPriceCzk, scheduledBillingPeriod: payment.billingPeriod || 'month',
          scheduledEffectiveAt: periodStart, scheduledPeriodEnd: periodEnd,
        } });
      } else if (payment.changeType === 'UPGRADE' && currentPeriodStillActive) {
        await tx.companySubscription.update({ where: { companyId: payment.companyId }, data: {
          planCode: payment.planCode, employeeLimit: payment.employeeLimit, monthlyPriceCzk,
          billingPeriod: payment.billingPeriod || subscription.billingPeriod || 'month',
          ...clearScheduledPlanChange(),
        } });
      } else {
        await tx.companySubscription.upsert({ where: { companyId: payment.companyId }, create: {
          id: randomUUID(), companyId: payment.companyId, planCode: payment.planCode, employeeLimit: payment.employeeLimit,
          monthlyPriceCzk, billingPeriod: payment.billingPeriod || 'month', status: 'ACTIVE',
          currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, gracePeriodEnd: new Date(periodEnd.getTime() + 5 * 86400000),
        }, update: { planCode: payment.planCode, employeeLimit: payment.employeeLimit, monthlyPriceCzk,
          billingPeriod: payment.billingPeriod || 'month', status: 'ACTIVE',
          currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, gracePeriodEnd: new Date(periodEnd.getTime() + 5 * 86400000),
          ...clearScheduledPlanChange() } });
      }
      return confirmed;
    } });
    sendJson(response, 200, { payment: result }); return true;
  }

  return false;
}
