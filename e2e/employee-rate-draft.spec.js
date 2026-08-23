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

function employee(status = 'ACTIVE') {
  return {
    id: 'membership-employee-1',
    userId: 'employee-user-1',
    name: 'Anna Employee',
    email: 'employee@example.test',
    status,
    hourlyRateCzk: '250.00',
    pendingSubmissions: 0,
    summary: { totalHours: '8.00' },
  };
}

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seedManager(page) {
  await page.addInitScript(({ sessionKey, user }) => {
    localStorage.setItem('worktrack-language', 'uk');
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        token: 'manager-token',
        user,
        lastVerifiedAt: new Date().toISOString(),
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    );
  }, { sessionKey: SESSION_KEY, user: managerUser() });
}

test('employee rate draft survives an unrelated employees refetch', async ({ page }) => {
  await seedManager(page);

  let employeeStatus = 'ACTIVE';
  let employeeListRequests = 0;
  const unexpected = [];

  await page.route(API_PATTERN, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();

    if (method === 'GET' && path === '/manager/employees') {
      employeeListRequests += 1;
      return json(route, {
        week: { weekStart: '2026-08-17', weekEnd: '2026-08-23' },
        employees: [employee(employeeStatus)],
      });
    }

    if (method === 'PATCH' && path === '/manager/employees/membership-employee-1') {
      const body = request.postDataJSON();
      if (body.status) employeeStatus = body.status;
      return json(route, { employee: employee(employeeStatus) });
    }

    if (method === 'GET' && path === '/notifications') {
      return json(route, { unreadCount: 0, notifications: [] });
    }

    if (method === 'GET' && path === '/me') {
      return json(route, { user: managerUser() });
    }

    unexpected.push(`${method} ${url.pathname}${url.search}`);
    return json(route, { error: 'Unexpected E2E API request' }, 500);
  });

  await page.goto('/employees');
  await page.getByRole('button', { name: /Anna Employee/ }).click();

  const dialog = page.getByRole('dialog');
  const rateInput = dialog.getByLabel('Ставка CZK');
  await expect(rateInput).toHaveValue('250.00');

  await rateInput.fill('300');
  await expect(rateInput).toHaveValue('300');

  await dialog.getByRole('button', { name: /Деактивувати/ }).click();
  await expect.poll(() => employeeListRequests).toBeGreaterThanOrEqual(2);

  await expect(rateInput).toHaveValue('300');
  expect(unexpected).toEqual([]);
});
