import { randomUUID } from 'node:crypto';

import { calculateNetWorkEntries } from './work-time-calculation.js';

function clean(value, max = 300) { return String(value ?? '').trim().slice(0, max); }
function money(value) { return Number(value || 0).toFixed(2); }
function iso(value) { return value ? new Date(value).toISOString() : ''; }
function dateOnly(value) { return new Date(value).toISOString().slice(0, 10); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function compactDate(value) { return dateOnly(value).replaceAll('-', ''); }
function cleanIban(value) { return clean(value, 80).replace(/\s+/g, '').toUpperCase(); }

function variableSymbolFor(invoiceNumber) {
  const parts = String(invoiceNumber || '').match(/(\d{4}).*?(\d{1,6})$/);
  if (parts) return `${parts[1]}${parts[2].padStart(6, '0')}`.slice(-10);
  const digits = String(invoiceNumber || '').replace(/\D/g, '');
  return digits.slice(-10) || '1';
}

function spaydValue(value) {
  return encodeURIComponent(String(value || '').replaceAll('*', ' ')).replace(/%20/g, '+');
}

function buildSpayd(invoice) {
  const seller = object(invoice.sellerSnapshot);
  const iban = cleanIban(seller.iban);
  if (!iban) return '';
  const variableSymbol = variableSymbolFor(invoice.invoiceNumber);
  const message = spaydValue(`Faktura ${invoice.invoiceNumber}`);
  return [
    'SPD*1.0',
    `ACC:${iban}`,
    `AM:${money(invoice.subtotal)}`,
    `CC:${invoice.currency || 'CZK'}`,
    `DT:${compactDate(invoice.dueDate)}`,
    `X-VS:${variableSymbol}`,
    `MSG:${message}`,
  ].join('*') + '*';
}

function isInvoiceOverdue(invoice, now = new Date()) {
  if (!['SENT', 'VIEWED'].includes(invoice?.status) || !invoice?.dueDate) return false;
  const due = new Date(invoice.dueDate);
  due.setUTCHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
}

function summarizeInvoices(invoices = []) {
  const summary = {
    currency: 'CZK',
    totalCount: invoices.length,
    openCount: 0,
    overdueCount: 0,
    paidCount: 0,
    cancelledCount: 0,
    openAmount: 0,
    overdueAmount: 0,
    paidAmount: 0,
  };
  for (const invoice of invoices) {
    const value = Number(invoice.subtotal || 0);
    if (['SENT', 'VIEWED'].includes(invoice.status)) {
      summary.openCount += 1;
      summary.openAmount += value;
      if (invoice.isOverdue) {
        summary.overdueCount += 1;
        summary.overdueAmount += value;
      }
    } else if (invoice.status === 'PAID') {
      summary.paidCount += 1;
      summary.paidAmount += value;
    } else if (invoice.status === 'CANCELLED') {
      summary.cancelledCount += 1;
    }
  }
  return {
    ...summary,
    openAmount: money(summary.openAmount),
    overdueAmount: money(summary.overdueAmount),
    paidAmount: money(summary.paidAmount),
  };
}

function monthRange(raw) {
  const value = clean(raw, 7);
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid invoice month');
  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Invalid invoice month');
  const start = new Date(Date.UTC(year, month - 1, 1));
  const endExclusive = new Date(Date.UTC(year, month, 1));
  return { value, year, start, end: new Date(endExclusive.getTime() - 86400000), endExclusive };
}

function profileTax(user) {
  const tax = object(object(user?.profile).taxInformation);
  return {
    businessName: clean(tax.businessName, 160),
    ico: clean(tax.ico, 32),
    dic: clean(tax.dic, 40),
    address: clean(tax.address),
    iban: clean(tax.iban, 80),
    currency: 'CZK',
    dueDays: Math.min(90, Math.max(1, Number.parseInt(tax.dueDays, 10) || 14)),
    prefix: clean(tax.prefix, 16).toUpperCase() || 'WT',
  };
}

function companyBilling(company) {
  const billing = object(company?.billingProfile);
  return {
    name: clean(company?.name, 160),
    ico: clean(billing.ico, 32),
    dic: clean(billing.dic, 40),
    address: clean(billing.address),
    email: clean(billing.email, 160),
  };
}

function assertSellerReady(tax) {
  if (!tax.businessName || !tax.ico || !tax.address || !tax.iban) throw new Error('Complete tax information before creating an invoice');
}
function assertBuyerReady(buyer) {
  if (!buyer.name || !buyer.ico || !buyer.address) throw new Error('Employer billing information is incomplete');
}
function employeeMembership(context) {
  const membership = context?.activeMembership || context?.membership;
  if (!membership || membership.role !== 'EMPLOYEE' || membership.status === 'INACTIVE') throw new Error('Employee access is required');
  return membership;
}
function managerMembership(context) {
  const membership = context?.activeMembership || context?.membership;
  if (!membership || membership.role !== 'MANAGER' || membership.status === 'INACTIVE') throw new Error('Manager access is required');
  return membership;
}

function invoiceItemDescription(entry) {
  const project = clean(entry?.project?.name, 160) || 'Práce';
  const note = clean(entry?.note, 1200);
  return note ? `${project} — ${note}` : project;
}

function serialize(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    variableSymbol: variableSymbolFor(invoice.invoiceNumber),
    paymentDescriptor: buildSpayd(invoice),
    isOverdue: isInvoiceOverdue(invoice),
    companyId: invoice.companyId,
    employeeMembershipId: invoice.employeeMembershipId,
    periodStart: dateOnly(invoice.periodStart),
    periodEnd: dateOnly(invoice.periodEnd),
    issueDate: dateOnly(invoice.issueDate),
    dueDate: dateOnly(invoice.dueDate),
    currency: invoice.currency,
    hourlyRate: money(invoice.hourlyRate),
    totalHours: money(invoice.totalHours),
    subtotal: money(invoice.subtotal),
    status: invoice.status,
    seller: invoice.sellerSnapshot || {},
    buyer: invoice.buyerSnapshot || {},
    sentAt: iso(invoice.sentAt),
    viewedAt: iso(invoice.viewedAt),
    paidAt: iso(invoice.paidAt),
    cancelledAt: iso(invoice.cancelledAt),
    createdAt: iso(invoice.createdAt),
    items: (invoice.items || []).map(item => ({
      id: item.id,
      workEntryId: item.workEntryId,
      description: item.description,
      workDate: dateOnly(item.workDate),
      hours: money(item.hours),
      hourlyRate: money(item.hourlyRate),
      amount: money(item.amount),
    })),
  };
}

async function nextInvoiceNumber(client, companyId, prefix, year) {
  const stem = `${prefix}-${year}-`;
  const latest = await client.invoice.findFirst({ where: { companyId, invoiceNumber: { startsWith: stem } }, orderBy: { invoiceNumber: 'desc' }, select: { invoiceNumber: true } });
  const current = Number.parseInt(latest?.invoiceNumber?.slice(stem.length), 10) || 0;
  return `${stem}${String(current + 1).padStart(4, '0')}`;
}

async function buildDraftContext(client, context, payload = {}) {
  const membership = employeeMembership(context);
  const range = monthRange(payload.month);
  const user = await client.user.findUnique({ where: { id: membership.userId } });
  const company = await client.company.findUnique({ where: { id: membership.companyId } });
  if (!user || !company) throw new Error('Invoice context not found');
  const tax = profileTax(user); const buyer = companyBilling(company); assertSellerReady(tax); assertBuyerReady(buyer);
  const fallbackRate = Number(membership.hourlyRateCzk || 0);
  if (!Number.isFinite(fallbackRate) || fallbackRate <= 0) throw new Error('Hourly rate must be greater than zero before creating an invoice');
  const storedEntries = await client.workEntry.findMany({ where: { companyId: membership.companyId, employeeMembershipId: membership.id, status: 'APPROVED', workDate: { gte: range.start, lt: range.endExclusive }, invoiceItems: { none: { invoice: { status: { not: 'CANCELLED' } } } } }, include: { project: true }, orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }] });
  if (!storedEntries.length) throw new Error('No uninvoiced approved hours for this month');
  const rules = { breakMinutes: Number(company.breakMinutes || 0), standardDailyHours: Number(company.standardDailyHours || 8) };
  const entries = calculateNetWorkEntries(storedEntries, rules).map(entry => {
    const rate = Number(entry.hourlyRateCzk ?? fallbackRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Hourly rate must be greater than zero before creating an invoice');
    const hours = Number(entry.netHours || 0);
    return { ...entry, invoiceHours: hours, invoiceRate: rate, invoiceAmount: hours * rate };
  });
  const totalHours = entries.reduce((sum, entry) => sum + entry.invoiceHours, 0);
  const subtotal = entries.reduce((sum, entry) => sum + entry.invoiceAmount, 0);
  const rate = totalHours > 0 ? subtotal / totalHours : fallbackRate;
  const issueDate = new Date(); issueDate.setUTCHours(0, 0, 0, 0);
  const dueDate = new Date(issueDate.getTime() + tax.dueDays * 86400000);
  return { membership, range, user, company, tax, buyer, rate, entries, totalHours, subtotal, issueDate, dueDate };
}

export async function previewInvoiceDraft(client, context, payload = {}) {
  const draft = await buildDraftContext(client, context, payload);
  const invoiceNumber = await nextInvoiceNumber(client, draft.membership.companyId, draft.tax.prefix, draft.range.year);
  const previewShape = { invoiceNumber, subtotal: draft.subtotal, currency: 'CZK', dueDate: draft.dueDate, sellerSnapshot: draft.tax };
  return { month: draft.range.value, invoiceNumber, variableSymbol: variableSymbolFor(invoiceNumber), paymentDescriptor: buildSpayd(previewShape), periodStart: dateOnly(draft.range.start), periodEnd: dateOnly(draft.range.end), issueDate: dateOnly(draft.issueDate), dueDate: dateOnly(draft.dueDate), currency: 'CZK', hourlyRate: money(draft.rate), totalHours: money(draft.totalHours), subtotal: money(draft.subtotal), seller: { ...draft.tax, email: draft.user.email, phone: draft.user.phone || '' }, buyer: { ...draft.buyer, companyId: draft.company.id }, itemsCount: draft.entries.length };
}

export async function createInvoiceDraft(client, context, payload = {}) {
  const draft = await buildDraftContext(client, context, payload);
  const invoiceNumber = await nextInvoiceNumber(client, draft.membership.companyId, draft.tax.prefix, draft.range.year);
  const invoice = await client.invoice.create({ data: { id: randomUUID(), companyId: draft.membership.companyId, employeeMembershipId: draft.membership.id, invoiceNumber, periodStart: draft.range.start, periodEnd: draft.range.end, issueDate: draft.issueDate, dueDate: draft.dueDate, currency: 'CZK', hourlyRate: money(draft.rate), totalHours: money(draft.totalHours), subtotal: money(draft.subtotal), status: 'DRAFT', sellerSnapshot: { ...draft.tax, email: draft.user.email, phone: draft.user.phone || '' }, buyerSnapshot: { ...draft.buyer, companyId: draft.company.id }, items: { create: draft.entries.map(entry => ({ id: randomUUID(), workEntryId: entry.id, description: invoiceItemDescription(entry), workDate: entry.workDate, hours: money(entry.invoiceHours), hourlyRate: money(entry.invoiceRate), amount: money(entry.invoiceAmount) })) } }, include: { items: { orderBy: { workDate: 'asc' } } } });
  return serialize(invoice);
}

export async function listEmployeeInvoices(client, context) {
  const membership = employeeMembership(context);
  const invoices = (await client.invoice.findMany({ where: { companyId: membership.companyId, employeeMembershipId: membership.id }, include: { items: { orderBy: { workDate: 'asc' } } }, orderBy: { createdAt: 'desc' } })).map(serialize);
  return { invoices, summary: summarizeInvoices(invoices) };
}

export async function getEmployeeInvoice(client, context, invoiceId) {
  const membership = employeeMembership(context);
  const invoice = await client.invoice.findFirst({
    where: { id: invoiceId, companyId: membership.companyId, employeeMembershipId: membership.id },
    include: { items: { orderBy: { workDate: 'asc' } } },
  });
  if (!invoice) throw new Error('Invoice not found');
  return serialize(invoice);
}

export async function sendInvoice(client, context, invoiceId) {
  const membership = employeeMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId, employeeMembershipId: membership.id }, include: { items: true } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be sent');
  return serialize(await client.invoice.update({ where: { id: invoice.id }, data: { status: 'SENT', sentAt: new Date() }, include: { items: { orderBy: { workDate: 'asc' } } } }));
}

export async function cancelInvoice(client, context, invoiceId) {
  const membership = employeeMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId, employeeMembershipId: membership.id } });
  if (!invoice) throw new Error('Invoice not found');
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(invoice.status)) throw new Error('Invoice cannot be cancelled');
  return serialize(await client.invoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED', cancelledAt: new Date() }, include: { items: { orderBy: { workDate: 'asc' } } } }));
}

export async function listManagerInvoices(client, context) {
  const membership = managerMembership(context);
  const raw = await client.invoice.findMany({ where: { companyId: membership.companyId, status: { not: 'DRAFT' } }, include: { items: true, employeeMembership: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
  const invoices = raw.map(invoice => ({ ...serialize(invoice), employee: { id: invoice.employeeMembership.id, name: invoice.employeeMembership.user.name || invoice.employeeMembership.user.email, email: invoice.employeeMembership.user.email } }));
  return { invoices, summary: summarizeInvoices(invoices) };
}

export async function getManagerInvoice(client, context, invoiceId) {
  const membership = managerMembership(context);
  const invoice = await client.invoice.findFirst({
    where: { id: invoiceId, companyId: membership.companyId, status: { not: 'DRAFT' } },
    include: { items: { orderBy: { workDate: 'asc' } }, employeeMembership: { include: { user: true } } },
  });
  if (!invoice) throw new Error('Invoice not found');
  return {
    ...serialize(invoice),
    employee: {
      id: invoice.employeeMembership.id,
      name: invoice.employeeMembership.user.name || invoice.employeeMembership.user.email,
      email: invoice.employeeMembership.user.email,
    },
  };
}

export async function markInvoiceViewed(client, context, invoiceId) {
  const membership = managerMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'SENT') {
    const current = await client.invoice.findUnique({ where: { id: invoice.id }, include: { items: { orderBy: { workDate: 'asc' } } } });
    return serialize(current);
  }
  return serialize(await client.invoice.update({ where: { id: invoice.id }, data: { status: 'VIEWED', viewedAt: new Date() }, include: { items: { orderBy: { workDate: 'asc' } } } }));
}

export async function markInvoicePaid(client, context, invoiceId) {
  const membership = managerMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId } });
  if (!invoice) throw new Error('Invoice not found');
  if (!['SENT', 'VIEWED'].includes(invoice.status)) throw new Error('Invoice cannot be marked paid');
  return serialize(await client.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() }, include: { items: { orderBy: { workDate: 'asc' } } } }));
}