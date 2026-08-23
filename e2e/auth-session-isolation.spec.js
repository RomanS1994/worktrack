import { expect, test } from '@playwright/test';

const API_PATTERN = 'http://127.0.0.1:3000/api/**';
const SESSION_KEY = 'react-auth-session';

function managerUser() {
  return {
    id: 'manager-user-1',
    email: 'manager@example.test',
    firstName: 'Roman',
    lastName: 'Manager',
    name: 'Roman Manager',
    phone: '',
    mustChangePassword: false,
    activeCompany: { id: 'company-1', name: 'Manager Company', slug: 'manager-company' },
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
    activeCompany: { id: 'company-2', name: 'Employee Company', slug: 'employee-company' },
    activeMembership: {
      id: 'employee-membership-1',
      companyId: 'company-2',
      userId: 'employee-user-1',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      hourlyRateCzk: '250.00',
    },
  };
}

function week() {
  return {
    weekStart: '2026-08-17',
    weekEnd: '2026-08-23',
    days: [
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ].map((date, index) => ({ date, label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] })),
  };
}

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seedManager(page) {
  await page.addInitScript(
    ({ key, user }) => {
      localStorage.setItem('worktrack-language', 'uk');
      localStorage.setItem(
        key,
        JSON.stringify({
          token: 'manager-token',
          user,
          lastVerifiedAt: new Date().toISOString(),
          accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      );
    },
    { key: SESSION_KEY, user: managerUser() },
  );
}

test('switching accounts clears protected RTK Query cache', async ({ page }) => {
  await seedManager(page);

  let currentRole = 'MANAGER';
  const summaryRequests = [];
  const unexpected = [];

  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();

    if (method === 'GET' && path === '/work-summary') {
      summaryRequests.push(currentRole);
      if (currentRole === 'MANAGER') {
        return json(route, {
          role: 'MANAGER',
          company: { id: 'company-1', name: 'Manager Company' },
          week: week(),
          summary: {
            employeeCount: 3,
            activeProjectCount: 1,
            pendingSubmissions: 0,
            approvedHours: '8.00',
            pendingHours: '0.00',
            confirmedSalaryCzk: '2000.00',
            predictedSalaryCzk: '0.00',
            notSubmittedCount: 0,
            needsChangesCount: 0,
          },
          team: { notSubmitted: [], needsChanges: [], submitted: [], approved: [] },
        });
      }

      return json(route, {
        role: 'EMPLOYEE',
        company: { id: 'company-2', name: 'Employee Company' },
        week: week(),
        submission: null,
        hourlyRateCzk: '250.00',
        summary: {
          totalHours: '4.00',
          approvedHours: '0.00',
          pendingHours: '4.00',
          confirmedSalaryCzk: '0.00',
          predictedSalaryCzk: '1000.00',
        },
      });
    }

    if (method === 'POST' && path === '/auth/logout') {
      return json(route, { ok: true });
    }

    if (method === 'POST' && path === '/auth/login') {
      currentRole = 'EMPLOYEE';
      return json(route, {
        token: 'employee-token',
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: employeeUser(),
      });
    }

    if (method === 'GET' && path === '/notifications') {
      return json(route, { unreadCount: 0, notifications: [] });
    }

    if (method === 'GET' && path === '/me') {
      return json(route, { user: currentRole === 'MANAGER' ? managerUser() : employeeUser() });
    }

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return json(route, { error: 'Unexpected E2E API request' }, 500);
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Manager Company').first()).toBeVisible();
  await expect.poll(() => summaryRequests.length).toBe(1);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.locator('input[name="username"]').fill('employee@example.test');
  await page.locator('input[name="current-password"]').fill('password123');
  await page.locator('.loginForm-button').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => summaryRequests).toEqual(['MANAGER', 'EMPLOYEE']);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('.statusNote.is-error')).toHaveCount(0);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/employees');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(unexpected).toEqual([]);
});
