import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('dual-role managers remain eligible for advances and expenses', async () => {
  const [advances, expenses, payroll] = await Promise.all([
    read('backend/routes/advances.js'),
    read('backend/routes/expenses.js'),
    read('backend/services/manager-payroll.js'),
  ]);

  assert.doesNotMatch(advances, /role:\s*['"]EMPLOYEE['"]/);
  assert.doesNotMatch(expenses, /role:\s*['"]EMPLOYEE['"]/);
  assert.match(payroll, /canAccessManagerCabinet:\s*membership\.role\s*===\s*['"]MANAGER['"]/);
  assert.doesNotMatch(payroll, /where:\s*\{[^}]*role:\s*['"]EMPLOYEE['"]/s);
});

test('manager invoice actions require cross-review', async () => {
  const [billing, managerInvoicesPage] = await Promise.all([
    read('backend/routes/billing.js'),
    read('frontend/webApp/src/react-app/pages/ManagerInvoicesPage/ManagerInvoicesPage.jsx'),
  ]);
  assert.match(billing, /employeeMembershipId===context\.activeMembership\.id/);
  assert.match(billing, /Managers cannot review their own invoice/);
  assert.match(billing, /managerReviewInvoice\(client,context,viewedMatch\[1\]\)/);
  assert.match(billing, /managerReviewInvoice\(client,context,paidMatch\[1\]\)/);
  assert.match(managerInvoicesPage, /invoice\.employeeMembershipId===ownMembershipId/);
  assert.match(managerInvoicesPage, /const canPay=!ownInvoice&&\['SENT','VIEWED'\]\.includes\(invoice\.status\)/);
});

test('cabinet-sensitive UI uses reactive cabinet mode', async () => {
  const [bottomTabs, sectionTabs, dashboard, payrollReport, notifications, protectedRoute] = await Promise.all([
    read('frontend/shared/src/react-app/app/components/BottomTabs/BottomTabs.jsx'),
    read('frontend/webApp/src/react-app/components/SectionTabs/SectionTabs.jsx'),
    read('frontend/webApp/src/react-app/pages/DashboardPage/DashboardPage.jsx'),
    read('frontend/webApp/src/react-app/pages/PayrollReportPage/PayrollReportPage.jsx'),
    read('frontend/webApp/src/react-app/pages/NotificationsPage/NotificationsPage.jsx'),
    read('frontend/shared/src/react-app/app/components/ProtectedRoute/ProtectedRoute.jsx'),
  ]);

  assert.match(bottomTabs, /useCabinetMode\(user\)/);
  assert.match(sectionTabs, /useCabinetMode\(user\)/);
  assert.match(dashboard, /useCabinetMode\(user\)/);
  assert.match(payrollReport, /useCabinetMode\(user\)/);
  assert.match(notifications, /setCabinetMode\(['"]manager['"],\s*user\)/);
  assert.match(notifications, /setCabinetMode\(['"]employee['"],\s*user\)/);
  assert.match(protectedRoute, /useCabinetMode\(user\)/);
  assert.match(protectedRoute, /requireManager\s*&&\s*\(!hasManagerAccess\(user\)\s*\|\|\s*cabinetMode\s*!==\s*['"]manager['"]\)/);
  assert.match(protectedRoute, /requireEmployee\s*&&\s*\(!hasEmployeeAccess\(user\)\s*\|\|\s*cabinetMode\s*!==\s*['"]employee['"]\)/);
});
