import { expect, test } from '@playwright/test';

const API_PATTERN = '**/api/**';
const SESSION_KEY = 'react-auth-session';
const LANGUAGE_KEY = 'worktrack-language';
const EMPLOYEE_ID = 'employee-membership-1';
const MANAGER_HOURS = {
  '2026-08-10': 10.5,
  '2026-08-11': 11,
  '2026-08-12': 10.5,
  '2026-08-13': 10,
  '2026-08-14': 10.5,
};

test.use({ viewport: { width: 390, height: 844 } });

function managerUser() {
  return {
    id: 'manager-user-1',
    email: 'manager@example.test',
    firstName: 'Roman',
    lastName: 'Manager',
    name: 'Roman Manager',
    mustChangePassword: false,
    activeCompany: { id: 'company-1', name: 'WorkTrack QA', slug: 'worktrack-qa' },
    activeMembership: {
      id: 'manager-membership-1',
      companyId: 'company-1',
      userId: 'manager-user-1',
      role: 'MANAGER',
      status: 'ACTIVE',
      hourlyRateCzk: '0.00',
    },
  };
}

function makeEntry(id, workDate, hours, endTime) {
  return {
    id,
    companyId: 'company-1',
    employeeMembershipId: EMPLOYEE_ID,
    employeeId: 'employee-user-1',
    projectId: 'project-1',
    project: { id: 'project-1', companyId: 'company-1', name: 'Sportcentrum TJ Lokomotiva', isActive: true },
    weeklySubmissionId: 'submission-1',
    workDate,
    hours: Number(hours).toFixed(2),
    netHours: Number(hours).toFixed(2),
    grossHours: (Number(hours) + 0.5).toFixed(2),
    breakMinutes: 30,
    startTime: '07:00',
    endTime,
    note: '',
    status: 'SUBMITTED',
    createdAt: `${workDate}T19:00:00.000Z`,
    updatedAt: `${workDate}T19:00:00.000Z`,
  };
}

function createState() {
  return {
    removed: false,
    decision: '',
    entries: [
      makeEntry('entry-10', '2026-08-10', 10.5, '18:00'),
      makeEntry('entry-11', '2026-08-11', 11, '18:30'),
      makeEntry('entry-12', '2026-08-12', 10.5, '18:00'),
      makeEntry('entry-13', '2026-08-13', 11.5, '19:00'),
      makeEntry('entry-14', '2026-08-14', 10.5, '18:00'),
    ],
  };
}

function summary(entries) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  return {
    totalHours: total.toFixed(2),
    approvedHours: '0.00',
    pendingHours: total.toFixed(2),
    confirmedSalaryCzk: '0.00',
    predictedSalaryCzk: (total * 300).toFixed(2),
  };
}

function submission(state) {
  return {
    id: 'submission-1',
    companyId: 'company-1',
    employeeMembershipId: EMPLOYEE_ID,
    employeeId: 'employee-user-1',
    reviewedByMembershipId: '',
    weekStart: '2026-08-10',
    weekEnd: '2026-08-16',
    status: 'SUBMITTED',
    submittedAt: '2026-08-16T19:00:00.000Z',
    reviewedAt: '',
    rejectionReason: '',
    createdAt: '2026-08-10T05:00:00.000Z',
    updatedAt: '2026-08-16T19:00:00.000Z',
    employee: {
      id: EMPLOYEE_ID,
      userId: 'employee-user-1',
      companyId: 'company-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '300.00',
      name: 'Zahar Arlamovskij',
      email: 'zahar@example.test',
    },
    entries: state.entries,
    summary: summary(state.entries),
    workRules: { breakMinutes: 30, standardDailyHours: '8.00' },
  };
}

function shiftHours(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 1440;
  return Math.max(0, (end - start - 30) / 60);
}

function timesheetPayload(state) {
  const days = Array.from({ length: 31 }, (_, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, '0')}`;
    const entry = state.entries.find(item => item.workDate === date);
    const employeeHours = entry ? Number(entry.hours) : null;
    const managerHours = Object.hasOwn(MANAGER_HOURS, date) ? MANAGER_HOURS[date] : null;
    const hasEmployee = employeeHours != null;
    const hasManager = managerHours != null;
    let status = 'EMPTY';
    const reasons = [];
    if (hasEmployee && hasManager) {
      if (Math.abs(employeeHours - managerHours) < 0.001) status = 'MATCH';
      else {
        status = 'MISMATCH';
        reasons.push('hours');
      }
    } else if (hasEmployee) {
      status = 'MISSING_MANAGER';
      reasons.push('missingManager');
    } else if (hasManager) {
      status = 'MISSING_EMPLOYEE';
      reasons.push('missingEmployee');
    }
    return {
      date,
      day: index + 1,
      status,
      reasons,
      employeeHours,
      managerHours,
      difference: hasEmployee && hasManager ? Number((managerHours - employeeHours).toFixed(2)) : null,
      employeeBreakMinutes: hasEmployee ? 30 : null,
      managerBreakMinutes: hasManager ? 30 : null,
      employeeProjects: hasEmployee ? ['Sportcentrum TJ Lokomotiva'] : [],
      employeeProjectIds: hasEmployee ? ['project-1'] : [],
      managerProjectId: hasManager ? 'project-1' : null,
      note: '',
    };
  });
  const problems = days.filter(day => ['MISMATCH', 'MISSING_MANAGER', 'MISSING_EMPLOYEE'].includes(day.status)).length;
  return {
    month: '2026-08',
    projects: [{ id: 'project-1', name: 'Sportcentrum TJ Lokomotiva' }],
    summary: { employees: 1, matched: 5 - problems, mismatches: problems, missing: 0, problems },
    rows: [{
      employeeId: EMPLOYEE_ID,
      name: 'Zahar Arlamovskij',
      status: 'ACTIVE',
      employeeTotal: Number(summary(state.entries).totalHours),
      managerTotal: Object.values(MANAGER_HOURS).reduce((sum, value) => sum + value, 0),
      difference: -1.5,
      problems,
      days,
    }],
  };
}

function reply(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seedSession(page) {
  await page.addInitScript(({ user, sessionKey, languageKey }) => {
    localStorage.setItem(languageKey, 'uk');
    localStorage.setItem(sessionKey, JSON.stringify({
      token: 'e2e-manager-token',
      user,
      lastVerifiedAt: new Date().toISOString(),
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
  }, { user: managerUser(), sessionKey: SESSION_KEY, languageKey: LANGUAGE_KEY });
}

async function installMocks(page, state) {
  const unexpected = [];
  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();

    if (method === 'GET' && path === '/manager/submissions') {
      return reply(route, { submissions: state.removed ? [] : [submission(state)] });
    }
    if (method === 'GET' && path === '/manager/submissions/submission-1') {
      return state.removed ? reply(route, { error: 'Weekly submission not found' }, 404) : reply(route, { submission: submission(state) });
    }
    if (method === 'GET' && path === '/manager/timesheet') return reply(route, timesheetPayload(state));
    if (method === 'GET' && path === '/projects') {
      return reply(route, { projects: [{ id: 'project-1', companyId: 'company-1', name: 'Sportcentrum TJ Lokomotiva', isActive: true }] });
    }
    if (method === 'GET' && path === '/notifications') return reply(route, { unreadCount: 0, notifications: [] });
    if (method === 'GET' && path === '/me') return reply(route, { user: managerUser() });

    if (method === 'PATCH' && path.startsWith('/manager/work-entries/')) {
      const entryId = path.split('/').pop();
      const body = request.postDataJSON();
      state.entries = state.entries.map(entry => {
        if (entry.id !== entryId) return entry;
        const nextHours = body.startTime && body.endTime ? shiftHours(body.startTime, body.endTime) : Number(body.hours);
        return {
          ...entry,
          projectId: body.projectId || entry.projectId,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          hours: nextHours.toFixed(2),
          netHours: nextHours.toFixed(2),
          note: body.note ?? entry.note,
        };
      });
      return reply(route, { entry: state.entries.find(entry => entry.id === entryId) });
    }
    if (method === 'DELETE' && path.startsWith('/manager/work-entries/')) {
      const entryId = path.split('/').pop();
      state.entries = state.entries.filter(entry => entry.id !== entryId);
      if (!state.entries.length) state.removed = true;
      return reply(route, { ok: true, submissionId: 'submission-1', submissionDeleted: state.removed });
    }
    if (method === 'DELETE' && path === '/manager/submissions/submission-1/clear') {
      state.entries = [];
      state.removed = true;
      state.decision = 'clear';
      return reply(route, { ok: true, deletedEntries: 5 });
    }
    if (method === 'POST' && path === '/manager/submissions/submission-1/approve') {
      state.removed = true;
      state.decision = 'approve';
      return reply(route, { submission: { ...submission(state), status: 'APPROVED' } });
    }
    if (method === 'POST' && path === '/manager/submissions/submission-1/reject') {
      state.removed = true;
      state.decision = 'reject';
      return reply(route, { submission: { ...submission(state), status: 'REJECTED', rejectionReason: request.postDataJSON().rejectionReason } });
    }

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return reply(route, { error: 'Unexpected approval E2E API request' }, 500);
  });
  return unexpected;
}

async function openDetail(page) {
  await page.goto('/approvals');
  await expect(page.locator('.approvalItem')).toHaveCount(1);
  await page.locator('.approvalItem').click();
  await expect(page.locator('.approvalWeekSummary')).toBeVisible();
}

test('mobile approval matches the mockup and resolves a timesheet mismatch through editing', async ({ page }) => {
  const state = createState();
  await seedSession(page);
  const unexpected = await installMocks(page, state);
  await openDetail(page);

  await expect(page.locator('.approvalWeekTotal')).toContainText('54.00 h');
  await expect(page.locator('.approvalEntry')).toHaveCount(5);
  await expect(page.locator('.approvalMismatchBanner')).toContainText('1 записі');
  await page.screenshot({ path: 'test-results/approvals-mobile-main.png', fullPage: true });

  await page.locator('.approvalMismatchBanner').click();
  await expect(page.locator('.approvalMismatchSheet')).toBeVisible();
  await expect(page.locator('.approvalMismatchCompare')).toContainText('11.50 h');
  await expect(page.locator('.approvalMismatchCompare')).toContainText('10.00 h');
  await expect(page.locator('.approvalMismatchCompare')).toContainText('+1.50 h');
  await page.screenshot({ path: 'test-results/approvals-mobile-mismatch.png', fullPage: true });

  await page.locator('.approvalMismatchSheet .approvalSheetPrimary').click();
  await expect(page.locator('.approvalEditorSheet')).toBeVisible();
  await page.getByLabel('До', { exact: true }).fill('17:30');
  await expect(page.locator('.approvalEditorCalculated')).toContainText('10.00 h');
  await page.locator('.approvalEditorSheet .approvalSheetPrimary').click();
  await expect(page.locator('.approvalEditorSheet')).toHaveCount(0);
  await expect(page.locator('.approvalMismatchBanner')).toHaveCount(0);
  await expect(page.locator('.approvalWeekTotal')).toContainText('52.50 h');

  await page.locator('.approvalEntryMore').nth(3).click();
  await expect(page.locator('.approvalActionMenu')).toContainText('Редагувати запис');
  await expect(page.locator('.approvalActionMenu')).toContainText('Видалити запис');
  await page.keyboard.press('Escape');

  await page.locator('.approvalRejectButton').click();
  await expect(page.locator('.approvalRejectSheet')).toBeVisible();
  await expect(page.locator('.approvalSheetDanger')).toBeDisabled();
  await page.getByLabel('Причина відхилення').fill('Виправте години за четвер.');
  await expect(page.locator('.approvalSheetDanger')).toBeEnabled();
  await page.locator('.approvalRejectSheet .approvalSheetSecondary').click();

  expect(unexpected).toEqual([]);
});

test('approving removes the reviewed week without a stale detail error', async ({ page }) => {
  const state = createState();
  await seedSession(page);
  const unexpected = await installMocks(page, state);
  await openDetail(page);

  await page.locator('.approvalApproveButton').click();
  await expect(page.locator('.approvalsEmpty')).toBeVisible();
  await expect(page.locator('.statusNote.is-error')).toHaveCount(0);
  expect(state.decision).toBe('approve');
  expect(unexpected).toEqual([]);
});

test('clearing a week closes the detail instead of loading the deleted submission', async ({ page }) => {
  const state = createState();
  await seedSession(page);
  const unexpected = await installMocks(page, state);
  await openDetail(page);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('.approvalEntriesHeader button').click();
  await page.getByRole('button', { name: 'Очистити тиждень' }).click();
  await expect(page.locator('.approvalsEmpty')).toBeVisible();
  await expect(page.locator('.statusNote.is-error')).toHaveCount(0);
  expect(state.decision).toBe('clear');
  expect(unexpected).toEqual([]);
});
