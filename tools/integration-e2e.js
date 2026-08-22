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

  console.log('Integration E2E passed: register -> employee -> hours -> submit -> approve -> payroll summary');
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
