import assert from 'node:assert/strict';

const baseUrl = process.env.INTEGRATION_API_URL || 'http://127.0.0.1:3000/api';

async function request(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${payload.error || JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const health = await request('/health');
  assert.equal(health.ok, true);
  assert.equal(health.database?.connected, true);

  const suffix = Date.now();
  const managerEmail = `manager-${suffix}@example.test`;
  const employeeEmail = `employee-${suffix}@example.test`;
  const managerPassword = 'ManagerPass123!';
  const employeePassword = 'EmployeePass123!';

  const registered = await request('/auth/register-company', {
    method: 'POST',
    body: {
      firstName: 'Integration',
      lastName: 'Manager',
      email: managerEmail,
      password: managerPassword,
      companyName: `Integration QA ${suffix}`,
    },
  });
  assert.equal(registered.user?.activeMembership?.role, 'MANAGER');
  const managerToken = registered.token;
  assert.ok(managerToken);

  const projectResponse = await request('/projects', {
    method: 'POST',
    token: managerToken,
    body: { name: 'Integration Project', address: 'Praha' },
  });
  const projectId = projectResponse.project?.id;
  assert.ok(projectId);

  const employeeResponse = await request('/manager/employees', {
    method: 'POST',
    token: managerToken,
    body: {
      firstName: 'Integration',
      lastName: 'Employee',
      email: employeeEmail,
      temporaryPassword: employeePassword,
      hourlyRateCzk: '250.00',
    },
  });
  assert.equal(employeeResponse.employee?.status, 'ACTIVE');

  const employeeLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: employeeEmail, password: employeePassword },
  });
  assert.equal(employeeLogin.user?.activeMembership?.role, 'EMPLOYEE');
  const employeeToken = employeeLogin.token;
  assert.ok(employeeToken);

  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  const weekStart = monday.toISOString().slice(0, 10);
  const invoiceMonth = weekStart.slice(0, 7);

  const entryResponse = await request('/work-entries', {
    method: 'POST',
    token: employeeToken,
    body: { projectId, workDate: weekStart, hours: '8' },
  });
  assert.equal(entryResponse.entry?.status, 'DRAFT');

  const submitted = await request('/weekly-submissions', {
    method: 'POST',
    token: employeeToken,
    body: { weekStart },
  });
  assert.equal(submitted.submission?.status, 'SUBMITTED');
  const submissionId = submitted.submission?.id;
  assert.ok(submissionId);

  const queue = await request('/manager/submissions?status=SUBMITTED', { token: managerToken });
  assert.ok(queue.submissions?.some(item => item.id === submissionId));

  const approved = await request(`/manager/submissions/${submissionId}/approve`, {
    method: 'POST',
    token: managerToken,
  });
  assert.equal(approved.submission?.status, 'APPROVED');

  const week = await request(`/work-entries?weekStart=${weekStart}`, { token: employeeToken });
  assert.equal(week.submission?.status, 'APPROVED');
  assert.equal(week.entries?.[0]?.status, 'APPROVED');
  assert.equal(week.summary?.approvedHours, '8.00');
  assert.equal(week.summary?.confirmedSalaryCzk, '2000.00');

  const companyBilling = await request('/company-billing', {
    method: 'PATCH',
    token: managerToken,
    body: {
      ico: '12345678',
      dic: 'CZ12345678',
      address: 'Integration Company, Praha 1, Czechia',
      email: managerEmail,
    },
  });
  assert.equal(companyBilling.company?.billingProfile?.ico, '12345678');

  const employeeTax = await request('/tax-information', {
    method: 'PATCH',
    token: employeeToken,
    body: {
      businessName: 'Integration Employee OSVC',
      ico: '87654321',
      dic: '',
      address: 'Integration Employee, Praha 2, Czechia',
      iban: 'CZ6508000000192000145399',
      dueDays: 14,
      prefix: 'IT',
    },
  });
  assert.equal(employeeTax.taxInformation?.currency, 'CZK');

  const preview = await request(`/invoices/preview?month=${invoiceMonth}`, { token: employeeToken });
  assert.equal(preview.preview?.totalHours, '8.00');
  assert.equal(preview.preview?.subtotal, '2000.00');
  assert.equal(preview.preview?.currency, 'CZK');
  assert.ok(preview.preview?.paymentDescriptor?.startsWith('SPD*1.0*'));

  const createdInvoice = await request('/invoices', {
    method: 'POST',
    token: employeeToken,
    body: { month: invoiceMonth },
  });
  assert.equal(createdInvoice.invoice?.status, 'DRAFT');
  assert.equal(createdInvoice.invoice?.totalHours, '8.00');
  assert.equal(createdInvoice.invoice?.subtotal, '2000.00');
  const invoiceId = createdInvoice.invoice?.id;
  assert.ok(invoiceId);

  const sentInvoice = await request(`/invoices/${invoiceId}/send`, {
    method: 'POST',
    token: employeeToken,
  });
  assert.equal(sentInvoice.invoice?.status, 'SENT');
  assert.ok(sentInvoice.invoice?.sentAt);

  const managerInvoices = await request('/manager/invoices', { token: managerToken });
  assert.ok(managerInvoices.invoices?.some(item => item.id === invoiceId));
  assert.equal(managerInvoices.summary?.openAmount, '2000.00');
  assert.equal(managerInvoices.summary?.openCount, 1);

  const viewedInvoice = await request(`/manager/invoices/${invoiceId}/viewed`, {
    method: 'POST',
    token: managerToken,
  });
  assert.equal(viewedInvoice.invoice?.status, 'VIEWED');
  assert.ok(viewedInvoice.invoice?.viewedAt);

  const paidInvoice = await request(`/manager/invoices/${invoiceId}/paid`, {
    method: 'POST',
    token: managerToken,
  });
  assert.equal(paidInvoice.invoice?.status, 'PAID');
  assert.ok(paidInvoice.invoice?.paidAt);

  const employeeInvoices = await request('/invoices', { token: employeeToken });
  const finalInvoice = employeeInvoices.invoices?.find(item => item.id === invoiceId);
  assert.equal(finalInvoice?.status, 'PAID');
  assert.equal(employeeInvoices.summary?.openAmount, '0.00');
  assert.equal(employeeInvoices.summary?.paidAmount, '2000.00');
  assert.equal(employeeInvoices.summary?.paidCount, 1);

  const history = await request(`/invoices/${invoiceId}/history`, { token: employeeToken });
  const actions = (history.history || []).map(item => item.action);
  assert.deepEqual(actions, ['invoice.created', 'invoice.sent', 'invoice.viewed', 'invoice.paid']);

  console.log('Integration E2E passed: register -> employee -> hours -> approve -> invoice -> send -> viewed -> paid');
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
