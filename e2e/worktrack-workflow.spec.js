import { expect, test } from '@playwright/test';

const API_PATTERN = 'http://127.0.0.1:3000/api/**';
const SESSION_KEY = 'react-auth-session';
const LANGUAGE_KEY = 'worktrack-language';
const DAY_MS = 86_400_000;

function userFor(role) {
  const manager = role === 'MANAGER';
  return {
    id: manager ? 'manager-user-1' : 'employee-user-1',
    email: manager ? 'manager@example.test' : 'employee@example.test',
    firstName: manager ? 'Roman' : 'Anna',
    lastName: manager ? 'Manager' : 'Employee',
    name: manager ? 'Roman Manager' : 'Anna Employee',
    mustChangePassword: false,
    activeCompany: { id: 'company-1', name: 'WorkTrack QA', slug: 'worktrack-qa' },
    activeMembership: {
      id: manager ? 'manager-membership-1' : 'employee-membership-1',
      companyId: 'company-1',
      userId: manager ? 'manager-user-1' : 'employee-user-1',
      role,
      status: 'ACTIVE',
      hourlyRateCzk: manager ? '0.00' : '250.00',
    },
  };
}

async function seedSession(page, role) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('worktrack-language', 'uk');
    localStorage.setItem('react-auth-session', JSON.stringify({
      token: `e2e-${user.activeMembership.role.toLowerCase()}-token`,
      user,
      lastVerifiedAt: new Date().toISOString(),
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
  }, { user: userFor(role) });
}

function buildWeek(weekStart) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
    label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
  }));
  return { weekStart, weekEnd: days[6].date, days };
}

function summary(entries) {
  const hours = status => entries.filter(entry => status.includes(entry.status)).reduce((n, entry) => n + Number(entry.hours), 0);
  const total = hours(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
  const approved = hours(['APPROVED']);
  const pending = hours(['DRAFT', 'SUBMITTED']);
  return {
    totalHours: total.toFixed(2), approvedHours: approved.toFixed(2), pendingHours: pending.toFixed(2),
    confirmedSalaryCzk: (approved * 250).toFixed(2), predictedSalaryCzk: (pending * 250).toFixed(2),
  };
}

function submissionPayload(state) {
  if (!state.submission) return null;
  return {
    ...state.submission,
    employee: {
      id: 'employee-membership-1', userId: 'employee-user-1', companyId: 'company-1', role: 'EMPLOYEE',
      status: 'ACTIVE', hourlyRateCzk: '250.00', name: 'Anna Employee', email: 'employee@example.test',
    },
    entries: state.entries,
    summary: summary(state.entries),
  };
}

function reply(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function shiftHours(startTime, endTime, breakMinutes = 30) {
  const [startHour, startMinute] = String(startTime || '07:00').split(':').map(Number);
  const [endHour, endMinute] = String(endTime || '15:30').split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start - breakMinutes) / 60);
}

async function mockApi(page, state, role, unexpected) {
  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();

    if (method === 'GET' && path === '/projects') {
      return reply(route, { projects: [{ id: 'project-1', companyId: 'company-1', name: 'Test Project', isActive: true }] });
    }

    if (method === 'GET' && path === '/work-rules') {
      return reply(route, { workRules: { standardDailyHours: '8.00', breakMinutes: 30 } });
    }

    if (method === 'GET' && path === '/default-project') {
      return reply(route, { projectId: 'project-1' });
    }

    if (method === 'GET' && path === '/work-entries') {
      const weekStart = url.searchParams.get('weekStart');
      if (!state.weekStart) state.weekStart = weekStart;
      const week = buildWeek(weekStart || state.weekStart);
      const entries = state.entries.filter(entry => entry.workDate >= week.weekStart && entry.workDate <= week.weekEnd);
      return reply(route, { week, entries, submission: state.submission?.weekStart === week.weekStart ? submissionPayload(state) : null, summary: summary(entries) });
    }

    if (method === 'POST' && path === '/work-entries') {
      const body = request.postDataJSON();
      const hours = shiftHours(body.startTime, body.endTime, 30);
      const entry = {
        id: `entry-${state.entries.length + 1}`,
        companyId: 'company-1',
        employeeMembershipId: 'employee-membership-1',
        employeeId: 'employee-user-1',
        projectId: body.projectId,
        project: { id: 'project-1', name: 'Test Project', isActive: true },
        weeklySubmissionId: '',
        workDate: body.workDate,
        hours: hours.toFixed(2),
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: 30,
        note: body.note || '',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.entries = [...state.entries.filter(item => !(item.workDate === entry.workDate && item.projectId === entry.projectId)), entry];
      return reply(route, { entry }, 201);
    }

    if (method === 'PATCH' && path.startsWith('/work-entries/')) {
      const entryId = path.split('/').pop();
      const body = request.postDataJSON();
      state.entries = state.entries.map(entry => {
        if (entry.id !== entryId) return entry;
        const startTime = body.startTime || entry.startTime;
        const endTime = body.endTime || entry.endTime;
        return {
          ...entry,
          startTime,
          endTime,
          hours: shiftHours(startTime, endTime, 30).toFixed(2),
          projectId: body.projectId || entry.projectId,
          note: body.note ?? entry.note,
        };
      });
      return reply(route, { entry: state.entries.find(entry => entry.id === entryId) });
    }

    if (method === 'DELETE' && path.startsWith('/work-entries/')) {
      const entryId = path.split('/').pop();
      state.entries = state.entries.filter(entry => entry.id !== entryId);
      return reply(route, { deleted: true });
    }

    if (method === 'POST' && path === '/weekly-submissions') {
      const body = request.postDataJSON();
      const week = buildWeek(body.weekStart);
      state.entries = state.entries.map(entry => ({ ...entry, weeklySubmissionId: 'submission-1', status: 'SUBMITTED' }));
      state.submission = {
        id: 'submission-1', companyId: 'company-1', employeeMembershipId: 'employee-membership-1', employeeId: 'employee-user-1',
        reviewedByMembershipId: '', weekStart: week.weekStart, weekEnd: week.weekEnd, status: 'SUBMITTED',
        submittedAt: new Date().toISOString(), reviewedAt: '', rejectionReason: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      return reply(route, { submission: submissionPayload(state) }, 201);
    }

    if (method === 'GET' && path === '/manager/submissions') {
      return reply(route, { submissions: state.submission?.status === 'SUBMITTED' ? [submissionPayload(state)] : [] });
    }
    if (method === 'GET' && path === '/manager/submissions/submission-1') return reply(route, { submission: submissionPayload(state) });
    if (method === 'GET' && path === '/manager/timesheet') {
      const month = url.searchParams.get('month') || '2026-08';
      const daysInMonth = new Date(`${month}-01T00:00:00.000Z`);
      const count = new Date(Date.UTC(daysInMonth.getUTCFullYear(), daysInMonth.getUTCMonth() + 1, 0)).getUTCDate();
      const days = Array.from({ length: count }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const entries = state.entries.filter(entry => entry.workDate === date && entry.status === 'SUBMITTED');
        const employeeHours = entries.length ? entries.reduce((total, entry) => total + Number(entry.hours || 0), 0) : null;
        return {
          date,
          day: index + 1,
          status: employeeHours == null ? 'EMPTY' : 'MATCH',
          reasons: [],
          employeeHours,
          managerHours: employeeHours,
          difference: employeeHours == null ? null : 0,
          employeeBreakMinutes: employeeHours == null ? null : 30,
          managerBreakMinutes: employeeHours == null ? null : 30,
          employeeProjects: entries.length ? ['Test Project'] : [],
          employeeProjectIds: entries.length ? ['project-1'] : [],
          managerProjectId: entries.length ? 'project-1' : null,
          note: '',
        };
      });
      return reply(route, {
        month,
        projects: [{ id: 'project-1', name: 'Test Project' }],
        summary: { employees: 1, matched: state.entries.length, mismatches: 0, missing: 0, problems: 0 },
        rows: [{ employeeId: 'employee-membership-1', name: 'Anna Employee', status: 'ACTIVE', employeeTotal: 8, managerTotal: 8, difference: 0, problems: 0, days }],
      });
    }
    if (method === 'POST' && path === '/manager/submissions/submission-1/approve') {
      state.entries = state.entries.map(entry => ({ ...entry, status: 'APPROVED' }));
      state.submission = { ...state.submission, status: 'APPROVED', reviewedByMembershipId: 'manager-membership-1', reviewedAt: new Date().toISOString() };
      return reply(route, { submission: submissionPayload(state) });
    }

    if (method === 'GET' && path === '/work-summary') {
      const week = buildWeek(state.weekStart || '2026-08-17');
      if (role === 'MANAGER') {
        const s = summary(state.entries);
        return reply(route, { role: 'MANAGER', company: { id: 'company-1', name: 'WorkTrack QA' }, week,
          summary: { employeeCount: 1, activeProjectCount: 1, pendingSubmissions: state.submission?.status === 'SUBMITTED' ? 1 : 0,
            approvedHours: s.approvedHours, pendingHours: s.pendingHours, confirmedSalaryCzk: s.confirmedSalaryCzk, predictedSalaryCzk: s.predictedSalaryCzk,
            notSubmittedCount: state.submission ? 0 : 1, needsChangesCount: 0 },
          team: { notSubmitted: [], needsChanges: [], submitted: [], approved: [] } });
      }
      return reply(route, { role: 'EMPLOYEE', company: { id: 'company-1', name: 'WorkTrack QA' }, week,
        submission: submissionPayload(state), hourlyRateCzk: '250.00', summary: summary(state.entries) });
    }

    if (method === 'GET' && path === '/notifications') return reply(route, { unreadCount: 0, notifications: [] });
    if (method === 'GET' && path === '/me') return reply(route, { user: userFor(role) });

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return reply(route, { error: 'Unexpected workflow E2E API request' }, 500);
  });
}

test('employee submit -> manager approve -> employee sees approved', async ({ browser }) => {
  const state = { weekStart: '', entries: [], submission: null };
  const unexpected = [];

  const employee = await browser.newContext();
  const employeePage = await employee.newPage();
  await seedSession(employeePage, 'EMPLOYEE');
  await mockApi(employeePage, state, 'EMPLOYEE', unexpected);
  await employeePage.goto('/hours');

  await employeePage.locator('.fastQuickTrigger').click();
  const quickDays = employeePage.locator('.fastQuickDays button');
  for (let index = 1; index < 5; index += 1) {
    await quickDays.nth(index).click();
  }
  await employeePage.locator('.fastQuickApply').click();
  await expect(employeePage.locator('.fastHeroTotal')).toContainText('8 год');

  await employeePage.locator('.fastSend').click();
  await expect(employeePage.locator('.fastHoursStatus')).toContainText('Відправлено');
  await employee.close();

  const manager = await browser.newContext();
  const managerPage = await manager.newPage();
  await seedSession(managerPage, 'MANAGER');
  await mockApi(managerPage, state, 'MANAGER', unexpected);
  await managerPage.goto('/approvals');
  await expect(managerPage.locator('.approvalItem')).toHaveCount(1);
  await managerPage.locator('.approvalApproveButton').click();
  await expect(managerPage.locator('.approvalItem')).toHaveCount(0);
  await manager.close();

  const approved = await browser.newContext();
  const approvedPage = await approved.newPage();
  await seedSession(approvedPage, 'EMPLOYEE');
  await mockApi(approvedPage, state, 'EMPLOYEE', unexpected);
  await approvedPage.goto(`/hours?date=${state.weekStart}`);
  await expect(approvedPage.locator('.fastHoursStatus')).toContainText('Погоджено');
  await expect(approvedPage.locator('.fastDayHours').first()).toContainText('8 год');
  await approved.close();

  expect(unexpected).toEqual([]);
  expect(state.submission?.status).toBe('APPROVED');
  expect(state.entries[0]?.status).toBe('APPROVED');
});
