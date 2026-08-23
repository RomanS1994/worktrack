import { randomUUID } from 'node:crypto';

function clean(value, max = 300) { return String(value ?? '').trim().slice(0, max); }
function money(value) { return Number(value || 0).toFixed(2); }
function iso(value) { return value ? new Date(value).toISOString() : ''; }
function dateOnly(value) { return new Date(value).toISOString().slice(0, 10); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

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
  if (!tax.businessName || !tax.ico || !tax.address || !tax.iban) {
    throw new Error('Complete tax information before creating an invoice');
  }
}
function assertBuyerReady(buyer) {
  if (!buyer.name || !buyer.ico || !buyer.address) {
    throw new Error('Employer billing information is incomplete');
  }
}
function employeeMembership(context) {
  const membership = context?.activeMembership || context?.membership;
  if (!membership || membership.role !== 'EMPLOYEE' || membership.status === 'INACTIVE') {
    throw new Error('Employee access is required');
  }
  return membership;
}
function managerMembership(context) {
  const membership = context?.activeMembership || context?.membership;
  if (!membership || membership.role !== 'MANAGER' || membership.status === 'INACTIVE') {
    throw new Error('Manager access is required');
  }
  return membership;
}

function serialize(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
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
  const latest = await client.invoice.findFirst({
    where: { companyId, invoiceNumber: { startsWith: stem } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const current = Number.parseInt(latest?.invoiceNumber?.slice(stem.length), 10) || 0;
  return `${stem}${String(current + 1).padStart(4, '0')}`;
}

async function buildDraftContext(client, context, payload = {}) {
  const membership = employeeMembership(context);
  const range = monthRange(payload.month);
  const user = await client.user.findUnique({ where: { id: membership.userId } });
  const company = await client.company.findUnique({ where: { id: membership.companyId } });
  if (!user || !company) throw new Error('Invoice context not found');

  const tax = profileTax(user);
  const buyer = companyBilling(company);
  assertSellerReady(tax);
  assertBuyerReady(buyer);

  const rate = Number(membership.hourlyRateCzk || 0);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Hourly rate must be greater than zero before creating an invoice');

  const entries = await client.workEntry.findMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      status: 'APPROVED',
      workDate: { gte: range.start, lt: range.endExclusive },
      invoiceItems: { none: { invoice: { status: { not: 'CANCELLED' } } } },
    },
    include: { project: true },
    orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
  });
  if (!entries.length) throw new Error('No uninvoiced approved hours for this month');

  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const subtotal = totalHours * rate;
  const issueDate = new Date();
  issueDate.setUTCHours(0, 0, 0, 0);
  const dueDate = new Date(issueDate.getTime() + tax.dueDays * 86400000);

  return { membership, range, user, company, tax, buyer, rate, entries, totalHours, subtotal, issueDate, dueDate };
}

export async function previewInvoiceDraft(client, context, payload = {}) {
  const draft = await buildDraftContext(client, context, payload);
  const invoiceNumber = await nextInvoiceNumber(client, draft.membership.companyId, draft.tax.prefix, draft.range.year);
  return {
    month: draft.range.value,
    invoiceNumber,
    periodStart: dateOnly(draft.range.start),
    periodEnd: dateOnly(draft.range.end),
    issueDate: dateOnly(draft.issueDate),
    dueDate: dateOnly(draft.dueDate),
    currency: 'CZK',
    hourlyRate: money(draft.rate),
    totalHours: money(draft.totalHours),
    subtotal: money(draft.subtotal),
    seller: { ...draft.tax, email: draft.user.email, phone: draft.user.phone || '' },
    buyer: { ...draft.buyer, companyId: draft.company.id },
    itemsCount: draft.entries.length,
  };
}

export async function createInvoiceDraft(client, context, payload = {}) {
  const draft = await buildDraftContext(client, context, payload);
  const invoiceNumber = await nextInvoiceNumber(client, draft.membership.companyId, draft.tax.prefix, draft.range.year);

  const invoice = await client.invoice.create({
    data: {
      id: randomUUID(),
      companyId: draft.membership.companyId,
      employeeMembershipId: draft.membership.id,
      invoiceNumber,
      periodStart: draft.range.start,
      periodEnd: draft.range.end,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      currency: 'CZK',
      hourlyRate: money(draft.rate),
      totalHours: money(draft.totalHours),
      subtotal: money(draft.subtotal),
      status: 'DRAFT',
      sellerSnapshot: { ...draft.tax, email: draft.user.email, phone: draft.user.phone || '' },
      buyerSnapshot: { ...draft.buyer, companyId: draft.company.id },
      items: {
        create: draft.entries.map(entry => ({
          id: randomUUID(),
          workEntryId: entry.id,
          description: entry.project?.name || 'Work',
          workDate: entry.workDate,
          hours: money(entry.hours),
          hourlyRate: money(draft.rate),
          amount: money(Number(entry.hours) * draft.rate),
        })),
      },
    },
    include: { items: { orderBy: { workDate: 'asc' } } },
  });
  return serialize(invoice);
}

export async function listEmployeeInvoices(client, context) {
  const membership = employeeMembership(context);
  return (await client.invoice.findMany({
    where: { companyId: membership.companyId, employeeMembershipId: membership.id },
    include: { items: { orderBy: { workDate: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })).map(serialize);
}

export async function sendInvoice(client, context, invoiceId) {
  const membership = employeeMembership(context);
  const invoice = await client.invoice.findFirst({
    where: { id: invoiceId, companyId: membership.companyId, employeeMembershipId: membership.id },
    include: { items: true },
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be sent');
  return serialize(await client.invoice.update({
    where: { id: invoice.id },
    data: { status: 'SENT', sentAt: new Date() },
    include: { items: { orderBy: { workDate: 'asc' } } },
  }));
}

export async function cancelInvoice(client, context, invoiceId) {
  const membership = employeeMembership(context);
  const invoice = await client.invoice.findFirst({
    where: { id: invoiceId, companyId: membership.companyId, employeeMembershipId: membership.id },
  });
  if (!invoice) throw new Error('Invoice not found');
  if (!['DRAFT', 'SENT', 'VIEWED'].includes(invoice.status)) throw new Error('Invoice cannot be cancelled');
  return serialize(await client.invoice.update({
    where: { id: invoice.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
    include: { items: { orderBy: { workDate: 'asc' } } },
  }));
}

export async function listManagerInvoices(client, context) {
  const membership = managerMembership(context);
  const invoices = await client.invoice.findMany({
    where: { companyId: membership.companyId, status: { not: 'DRAFT' } },
    include: { items: true, employeeMembership: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return invoices.map(invoice => ({
    ...serialize(invoice),
    employee: {
      id: invoice.employeeMembership.id,
      name: invoice.employeeMembership.user.name || invoice.employeeMembership.user.email,
      email: invoice.employeeMembership.user.email,
    },
  }));
}

export async function markInvoiceViewed(client, context, invoiceId) {
  const membership = managerMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'SENT') {
    const current = await client.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: { orderBy: { workDate: 'asc' } } },
    });
    return serialize(current);
  }
  return serialize(await client.invoice.update({
    where: { id: invoice.id },
    data: { status: 'VIEWED', viewedAt: new Date() },
    include: { items: { orderBy: { workDate: 'asc' } } },
  }));
}

export async function markInvoicePaid(client, context, invoiceId) {
  const membership = managerMembership(context);
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, companyId: membership.companyId } });
  if (!invoice) throw new Error('Invoice not found');
  if (!['SENT', 'VIEWED'].includes(invoice.status)) throw new Error('Invoice cannot be marked paid');
  return serialize(await client.invoice.update({
    where: { id: invoice.id },
    data: { status: 'PAID', paidAt: new Date() },
    include: { items: { orderBy: { workDate: 'asc' } } },
  }));
}
