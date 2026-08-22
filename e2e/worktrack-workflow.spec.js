import { expect, test } from '@playwright/test';

const API_PATTERN = 'http://127.0.0.1:3000/api/**';
const SESSION_KEY = 'react-auth-session';
const LANGUAGE_KEY = 'worktrack-language';
const DAY_MS = 86_400_000;

function userFor(role) {
  const isManager = role === 'MANAGER';
  return {
    id: isManager ? 'manager-user-1' : 'employee-user-1',
    email: isManager ? 'manager@example.test' : 'employee@example.test',
    firstName: isManager ? 'Roman' : 'Anna',
    lastName: isManager ? 'Manager' : 'Employee',
    name: isManager ? 'Roman Manager' : 'Anna Employee',
    phone: '',
    mustChangePassword: false,
    activeCompany: { id: 'company-1', name: 'WorkTrack QA', slug: 'worktrack-qa' },
    activeMembership: {
      id: isManager ? 'manager-membership-1' : 'employee-membership-1',
      companyId: 'company-1',
      userId: isManager ? 'manager-user-1' : 'employee-user-1',
      role,
      status: 'ACTIVE',
      hourlyRateCzk: isManager ? '0.00' : '250.00',
    },
  };
}

async function seedSession(page, role) {
  await page.addInitScript(
    ({ sessionKey, languageKey, user }) => {
      localStorage.setItem(languageKey, 'uk');
      localStorage.setItem(sessionKey, JSON.stringify({
        token: `e2e-${user.activeMembership.role.toLowerCase()}-token`,
        user,
        lastVerifiedAt: new Date().toISOString(),
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }));
    },
    { sessionKey: SESSION_KEY, languageKey: LANGUAGE_KEY, user: userFor(role) },
  );
}

function buildWeek(weekStart) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return {
      date: date.toISOString().slice(0, 10),
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
    };
  });
  return { weekStart, weekEnd: days[6].date, days };
}

function summaryFor(entries) {
  const approved = entries
    .filter(entry => entry.status === 'APPROVED')
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const pending = entries
    .filter(entry => ['DRAFT', 'SUBMITTED'].includes(entry.status))
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const total = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  return {
    totalHours: total.toFixed(2),
    approvedHours: approved.toFixed(2),
    pendingHours: pending.toFixed(2),
    confirmedSalaryCzk: (approved * 250).toFixed(2),
    predictedSalaryCzk: (pending * 250).toFixed(2),
  };
}

function serializeSubmission(state) {
  if (!state.submission) return null;
  return {
    ...state.submission,
    employee: {
      id: 'employee-membership-1',
      userId: 'employee-user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '250.00',
      name: 'Anna Employee',
      email: 'employee@example.test',
    },
    entries: state.entries,
    summary: summaryFor(state.entries),
  };
}

function fulfill(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installStatefulApi(page, state, role) {
  const unexpected = [];

  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();

    if (method === 'GET' && path === '/projects') {
      return fulfill(route, {
        projects: [{
          id: 'project-1',
          companyId: 'company-1',
          name: 'Test Project',
          address: 'Praha',
          description: '',
          isActive: true,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        }],
      });
    }

    if (method === 'GET' && path === '/work-entries') {
      const requestedWeekStart = url.searchParams.get('weekStart');
      if (!state.weekStart) state.weekStart = requestedWeekStart;
      const week = buildWeek(requestedWeekStart || state.weekStart);
      const inWeek = state.entries.filter(entry => entry.workDate >= week.weekStart && entry.workDate <= week.weekEnd);
      return fulfill(route, {
        week,
        entries: inWeek,
        submission: state.submission?.weekStart === week.weekStart ? serializeSubmission(state) : null,
        summary: summaryFor(inWeek),
      });
    }

    if (method === 'POST' && path === '/work-entries') {
      const body = request.postDataJSON();
      const entry = {
        id: 'entry-1',
        companyId: 'company-1',
        employeeMembershipId: 'employee-membership-1',
        employeeId: 'employee-user-1',
        projectId: body.projectId,
        project: { id: 'project-1', companyId: 'company-1', name: 'Test Project', isActive: true },
        weeklySubmissionId: '',
        workDate: body.workDate,
        hours: Number(body.hours).toFixed(2),
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.entries = [entry];
      return fulfill(route, { entry }, 201);
    }

    if (method === 'POST' && path === '/weekly-submissions') {
      const body = request.postDataJSON();
      const week = buildWeek(body.weekStart);
      state.entries = state.entries.map(entry => ({
        ...entry,
        weeklySubmissionId: 'submission-1',
        status: 'SUBMITTED',
      }));
      state.submission = {
        id: 'submission-1',
        companyId: 'company-1',
        employeeMembershipId: 'employee-membership-1',
        reviewedByMembershipId: '',
        employeeId: 'employee-user-1',
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        reviewedAt: '',
        rejectionReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return fulfill(route, { submission: serializeSubmission(state) }, 201);
    }

    if (method === 'GET' && path === '/manager/submissions') {
      return fulfill(route, {
        submissions: state.submission?.status === 'SUBMITTED' ? [serializeSubmission(state)] : [],
      });
    }

    if (method === 'GET' && path === '/manager/submissions/submission-1') {
      return fulfill(route, { submission: serializeSubmission(state) });
    }

    if (method === 'POST' && path === '/manager/submissions/submission-1/approve') {
      state.entries = state.entries.map(entry => ({ ...entry, status: 'APPROVED' }));
      state.submission = {
        ...state.submission,
        status: 'APPROVED',
        reviewedByMembershipId: 'manager-membership-1',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return fulfill(route, { submission: serializeSubmission(state) });
    }

    if (method === 'GET' && path === '/work-summary') {
      const weekStart = state.weekStart || '2026-08-17';
      if (role === 'MANAGER') {
        return fulfill(route, {
          role: 'MANAGER',
          company: { id: 'company-1', name: 'WorkTrack QA' },
          week: buildWeek(weekStart),
          summary: {
            employeeCount: 1,
            activeProjectCount: 1,
            pendingSubmissions: state.submission?.status === 'SUBMITTED' ? 1 : 0,
            approvedHours: summaryFor(state.entries).approvedHours,
            pendingHours: summaryFor(state.entries).pendingHours,
            confirmedSalaryCzk: summaryFor(state.entries).confirmedSalaryCzk,
            predictedSalaryCzk: summaryFor(state.entries).predictedSalaryCzk,
            notSubmittedCount: state.submission ? 0 : 1,
            needsChangesCount: 0,
          },
          team: { notSubmitted: [], needsChanges: [], submitted: [], approved: [] },
        });
      }
      return fulfill(route, {
        role: 'EMPLOYEE',
        company: { id: 'company-1', name: 'WorkTrack QA' },
        week: buildWeek(weekStart),
        submission: serializeSubmission(state),
        hourlyRateCzk: '250.00',
        summary: summaryFor(state.entries),
      });
    }

    if (method === 'GET' && path === '/notifications') {
      return fulfill(route, { unreadCount: 0, notifications: [] });
    }

    if (method === 'GET' && path === '/me') {
      return fulfill(route, { user: userFor(role) });
    }

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return fulfill(route, { error: 'Unexpected workflow E2E API request' }, 500);
  });

  return unexpected;
}

test('employee hours can be submitted, approved by manager, and observed as approved', async ({ browser }) => {
  const state = { weekStart: '', entries: [], submission: null };
  const unexpected = [];

  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  await seedSession(employeePage, 'EMPLOYEE');
  unexpected.push(...await installStatefulApi(employeePage, state, 'EMPLOYEE'));

  await employeePage.goto('/hours');
  const firstNewRow = employeePage.locator('.hoursEntryRow--new').first();
  await firstNewRow.locator('input[type="number"]').fill('8');
  await firstNewRow.getByRole('button', { name: 'Додати' }).click();
  await expect(employeePage.locator('.hoursEntryRow:not(.hoursEntryRow--new)')).toHaveCount(1);
  await expect(employeePage.locator('.hoursSubmitButton')).toBeEnabled();
  await employeePage.locator('.hoursSubmitButton').click();
  await expect(employeePage.locator('.hoursStatusBadge')).toContainText('Відправлено');
  await employeeContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await seedSession(managerPage, 'MANAGER');
  unexpected.push(...await installStatefulApi(managerPage, state, 'MANAGER'));

  await managerPage.goto('/approvals');
  await expect(managerPage.locator('.approvalItem')).toHaveCount(1);
  await expect(managerPage.locator('.approvalDetail')).toContainText('Anna Employee');
  await managerPage.locator('.approvalApprove').click();
  await expect(managerPage.locator('.approvalItem')).toHaveCount(0);
  await managerContext.close();

  const approvedContext = await browser.newContext();
  const approvedPage = await approvedContext.newPage();
  await seedSession(approvedPage, 'EMPLOYEE');
  unexpected.push(...await installStatefulApi(approvedPage, state, 'EMPLOYEE'));

  await approvedPage.goto(`/hours?weekStart=${state.weekStart}`);
  await expect(approvedPage.locator('.hoursStatusBadge')).toContainText('Погоджено');
  await expect(approvedPage.locator('.hoursEntryRow:not(.hoursEntryRow--new)')).toContainText('8.00');
  await approvedContext.close();

  expect(unexpected).toEqual([]);
  expect(state.submission?.status).toBe('APPROVED');
  expect(state.entries[0]?.status).toBe('APPROVED');
});
