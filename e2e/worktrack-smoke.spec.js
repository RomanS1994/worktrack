import { expect, test } from '@playwright/test';

const API_PATTERN = 'http://127.0.0.1:3000/api/**';
const SESSION_KEY = 'react-auth-session';
const LANGUAGE_KEY = 'worktrack-language';

function managerUser() {
  return {
    id: 'manager-user-1',
    email: 'manager@example.test',
    firstName: 'Roman',
    lastName: 'Manager',
    name: 'Roman Manager',
    phone: '',
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

function employeeUser() {
  return {
    id: 'employee-user-1',
    email: 'employee@example.test',
    firstName: 'Anna',
    lastName: 'Employee',
    name: 'Anna Employee',
    phone: '',
    mustChangePassword: false,
    activeCompany: { id: 'company-1', name: 'WorkTrack QA', slug: 'worktrack-qa' },
    activeMembership: {
      id: 'employee-membership-1',
      companyId: 'company-1',
      userId: 'employee-user-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '250.00',
    },
  };
}

function buildWeek(weekStart = '2026-08-17') {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return {
      date: date.toISOString().slice(0, 10),
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
    };
  });
  return {
    weekStart,
    weekEnd: days[6].date,
    days,
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function seedSession(page, user) {
  await page.addInitScript(
    ({ sessionKey, languageKey, sessionUser }) => {
      localStorage.setItem(languageKey, 'uk');
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          token: 'e2e-access-token',
          user: sessionUser,
          lastVerifiedAt: new Date().toISOString(),
          accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      );
    },
    { sessionKey: SESSION_KEY, languageKey: LANGUAGE_KEY, sessionUser: user },
  );
}

async function installApiMocks(page, role) {
  const unexpected = [];
  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();
    const weekStart = url.searchParams.get('weekStart') || '2026-08-17';
    const week = buildWeek(weekStart);

    if (method === 'GET' && path === '/work-summary') {
      if (role === 'MANAGER') {
        return json(route, {
          role: 'MANAGER',
          company: { id: 'company-1', name: 'WorkTrack QA' },
          week,
          summary: {
            employeeCount: 1,
            activeProjectCount: 1,
            pendingSubmissions: 0,
            approvedHours: '8.00',
            pendingHours: '0.00',
            confirmedSalaryCzk: '2000.00',
            predictedSalaryCzk: '0.00',
            notSubmittedCount: 1,
            needsChangesCount: 0,
          },
          team: { notSubmitted: [], needsChanges: [], submitted: [], approved: [] },
        });
      }
      return json(route, {
        role: 'EMPLOYEE',
        company: { id: 'company-1', name: 'WorkTrack QA' },
        week,
        submission: null,
        hourlyRateCzk: '250.00',
        summary: {
          totalHours: '8.00',
          approvedHours: '0.00',
          pendingHours: '8.00',
          confirmedSalaryCzk: '0.00',
          predictedSalaryCzk: '2000.00',
        },
      });
    }

    if (method === 'GET' && path === '/projects') {
      return json(route, {
        projects: [
          {
            id: 'project-1',
            companyId: 'company-1',
            name: 'Test Project',
            address: 'Praha',
            description: '',
            isActive: true,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      });
    }

    if (method === 'GET' && path === '/work-entries') {
      return json(route, {
        week,
        entries: [],
        submission: null,
        summary: {
          totalHours: '0.00',
          approvedHours: '0.00',
          pendingHours: '0.00',
          confirmedSalaryCzk: '0.00',
          predictedSalaryCzk: '0.00',
        },
      });
    }

    if (method === 'GET' && path === '/notifications') {
      return json(route, { unreadCount: 0, notifications: [] });
    }

    if (method === 'GET' && path === '/company-settings') {
      return json(route, { company: { id: 'company-1', name: 'WorkTrack QA', slug: 'worktrack-qa' } });
    }

    if (method === 'GET' && path === '/company-billing') {
      return json(route, {
        company: {
          id: 'company-1',
          name: 'WorkTrack QA',
          billingProfile: {
            ico: '12345678',
            dic: 'CZ12345678',
            address: 'Václavské náměstí 1, Praha',
            email: 'billing@example.test',
          },
        },
      });
    }

    if (method === 'GET' && path === '/invoices') {
      return json(route, { invoices: [] });
    }

    if (method === 'GET' && path === '/manager/invoices') {
      return json(route, { invoices: [] });
    }

    if (method === 'GET' && path === '/manager/employees') {
      return json(route, { week, employees: [] });
    }

    if (method === 'GET' && path === '/manager/submissions') {
      return json(route, { submissions: [] });
    }

    if (method === 'GET' && path === '/manager/payroll') {
      return json(route, {
        role: 'MANAGER',
        company: { id: 'company-1', name: 'WorkTrack QA' },
        period: {
          type: url.searchParams.get('period') || 'week',
          anchor: url.searchParams.get('anchor') || '2026-08-17',
          start: '2026-08-17',
          end: '2026-08-23',
        },
        employees: [],
        summary: {
          employeeCount: 0,
          employeesWithHours: 0,
          approvedHours: '0.00',
          pendingHours: '0.00',
          confirmedSalaryCzk: '0.00',
          predictedSalaryCzk: '0.00',
        },
      });
    }

    if (method === 'GET' && path === '/me') {
      return json(route, { user: role === 'MANAGER' ? managerUser() : employeeUser() });
    }

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return json(route, { error: 'Unexpected E2E API request' }, 500);
  });

  return unexpected;
}

async function expectScreen(page, path) {
  const errors = [];
  page.once('pageerror', error => errors.push(error.message));
  await page.goto(path);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('.statusNote.is-error')).toHaveCount(0);
  expect(errors, `Runtime errors while opening ${path}`).toEqual([]);
}

test('manager can open every manager screen and is blocked from employee-only screens', async ({ page }) => {
  await seedSession(page, managerUser());
  const unexpected = await installApiMocks(page, 'MANAGER');

  for (const path of [
    '/dashboard',
    '/employees',
    '/projects',
    '/approvals',
    '/payroll-report',
    '/notifications',
    '/company-settings',
    '/manager/invoices',
    '/profile',
  ]) {
    await expectScreen(page, path);
  }

  await page.goto('/hours');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('h1').first()).toBeVisible();

  expect(unexpected).toEqual([]);
});

test('employee can open every employee screen and is blocked from manager-only screens', async ({ page }) => {
  await seedSession(page, employeeUser());
  const unexpected = await installApiMocks(page, 'EMPLOYEE');

  for (const path of [
    '/dashboard',
    '/hours',
    '/calendar',
    '/invoices',
    '/payroll-report',
    '/notifications',
    '/profile',
  ]) {
    await expectScreen(page, path);
  }

  await page.goto('/employees');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('h1').first()).toBeVisible();

  expect(unexpected).toEqual([]);
});
