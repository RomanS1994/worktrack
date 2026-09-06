import { test, expect } from '@playwright/test';

const APP = process.env.E2E_APP_URL || 'http://127.0.0.1:4173';
const password = process.env.E2E_USER_PASSWORD;
const runId = String(process.env.E2E_RUN_ID || 'local').replace(/[^a-zA-Z0-9-]/g, '-');
const romanEmail = `roman-e2e-${runId}@example.test`;
const mishaEmail = `misha-e2e-${runId}@example.test`;
const CABINET_STORAGE_KEY = 'worktrack.activeCabinet';

async function login(page, email) {
  await page.goto(`${APP}/sign-in`);
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="current-password"]').fill(password);
  await page.locator('form.loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function setCabinet(page, mode) {
  await page.evaluate(({ key, nextMode }) => {
    localStorage.setItem(key, nextMode);
  }, { key: CABINET_STORAGE_KEY, nextMode: mode });
  await page.reload();

  const expectedLabel = mode === 'manager'
    ? /Менеджер|Manager|Manažer/
    : /Працівник|Employee|Pracovník/;
  await expect(page.getByText(expectedLabel, { exact: true }).first()).toBeVisible();
}

async function resetBrowserSession(page, context) {
  await context.clearCookies();
  await page.goto(APP);
  await page.evaluate(key => {
    localStorage.removeItem('react-auth-session');
    localStorage.removeItem(key);
  }, CABINET_STORAGE_KEY);
}

test('Roman submits his week, Misha approves it, Roman sees approved', async ({ page, context }) => {
  expect(password).toBeTruthy();

  await login(page, romanEmail);
  await setCabinet(page, 'employee');
  await page.goto(`${APP}/hours`);

  const draftStatus = page.getByText(/Чернетка|Draft|Koncept/).first();
  await expect(draftStatus).toBeVisible();

  const submitButton = page.getByRole('button', { name: /Відправити тиждень менеджеру|Send week to manager|Odeslat týden manažerovi/ });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await expect(page.getByText(/Відправлено|Submitted|Odesláno/).first()).toBeVisible();

  await resetBrowserSession(page, context);
  await login(page, mishaEmail);
  await setCabinet(page, 'manager');
  await page.goto(`${APP}/approvals`);

  const romanSubmission = page.getByRole('button', { name: /Roman E2E/i }).first();
  await expect(romanSubmission).toBeVisible();
  await romanSubmission.click();

  const approveButton = page.getByRole('button', { name: /Погодити|Approve|Schválit/i }).last();
  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  const earlyConfirm = page.getByRole('button', { name: /Все одно погодити|Approve anyway|Přesto schválit/i });
  if (await earlyConfirm.isVisible().catch(() => false)) {
    await earlyConfirm.click();
  }

  await expect(page.getByText(/Тиждень погоджено|Week approved|Týden schválen/i)).toBeVisible();

  await resetBrowserSession(page, context);
  await login(page, romanEmail);
  await setCabinet(page, 'employee');
  await page.goto(`${APP}/hours`);

  await expect(page.getByText(/Погоджено|Approved|Schváleno/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Відправити тиждень менеджеру|Send week to manager|Odeslat týden manažerovi/ })).toBeDisabled();
});
