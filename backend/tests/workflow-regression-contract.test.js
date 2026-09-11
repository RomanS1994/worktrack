import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const employeeWorkServicePath = fileURLToPath(new URL('../services/employee-work.js', import.meta.url));
const invoiceServicePath = fileURLToPath(new URL('../services/invoices.js', import.meta.url));
const managerRoutePath = fileURLToPath(new URL('../routes/manager/index.js', import.meta.url));
const managerDashboardServicePath = fileURLToPath(new URL('../services/manager-dashboard.js', import.meta.url));
const notificationsServicePath = fileURLToPath(new URL('../services/notifications.js', import.meta.url));
const fastHoursSupportPath = fileURLToPath(new URL('../../frontend/webApp/src/react-app/pages/FastHoursPage/fastHoursSupport.jsx', import.meta.url));

test('month-boundary weeks submit and lock only the active calendar-month segment', async () => {
  const [employeeWorkSource, invoiceSource, fastHoursSource] = await Promise.all([
    readFile(employeeWorkServicePath, 'utf8'),
    readFile(invoiceServicePath, 'utf8'),
    readFile(fastHoursSupportPath, 'utf8'),
  ]);

  assert.match(employeeWorkSource, /const requestedMonth = \/\^\\d\{4\}-\\d\{2\}\$\/\.test\(String\(payload\.month \|\| ''\)\)/);
  assert.match(employeeWorkSource, /const availableMonths = new Set\(draftEntries\.map\(entry => monthKey\(entry\.workDate\)\)\)/);
  assert.match(employeeWorkSource, /const targetMonth = requestedMonth && availableMonths\.has\(requestedMonth\)[\s\S]*?\? requestedMonth[\s\S]*?: monthKey\(draftEntries\[0\]\.workDate\)/);
  assert.match(employeeWorkSource, /draftEntries\.filter\(entry => monthKey\(entry\.workDate\) === targetMonth\)/);
  assert.match(employeeWorkSource, /const segment = monthSegment\(range, targetMonth\)/);
  assert.match(employeeWorkSource, /weekStart: segment\.start/);
  assert.match(employeeWorkSource, /weekEnd: segment\.end/);

  assert.match(invoiceSource, /status: 'APPROVED'/);
  assert.match(invoiceSource, /workDate: \{ gte: range\.start, lt: range\.endExclusive \}/);

  assert.match(
    fastHoursSource,
    /dateLocked=\(date,submissions\)=>submissions\.some\(s=>isLockedStatus\(s\.status\)&&s\.weekStart<=date&&s\.weekEnd>=date\)/,
  );
});

test('manager approval and rejection always create an employee notification', async () => {
  const [managerRouteSource, notificationsSource] = await Promise.all([
    readFile(managerRoutePath, 'utf8'),
    readFile(notificationsServicePath, 'utf8'),
  ]);

  assert.match(managerRouteSource, /reviewWeeklySubmission\(client, context, approvalMatch\[1\], decision/);
  assert.match(managerRouteSource, /await notifyEmployeeAboutReview\(client, context, reviewedSubmission\)/);

  assert.match(notificationsSource, /recipientMembershipId: submission\.employeeMembershipId/);
  assert.match(notificationsSource, /type: isRejected \? 'weekly_submission\.rejected' : 'weekly_submission\.approved'/);
  assert.match(notificationsSource, /href: `\/hours\?date=\$\{submission\.weekStart\}`/);
});

test('manager dashboard counts every outstanding approval shown by the approval queue', async () => {
  const source = await readFile(managerDashboardServicePath, 'utf8');
  const start = source.indexOf('client.weeklySubmission.count({');
  const end = source.indexOf('client.companyMembership.findMany({', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const countQuery = source.slice(start, end);

  assert.match(countQuery, /companyId: membership\.companyId/);
  assert.match(countQuery, /employeeMembershipId: \{ not: membership\.id \}/);
  assert.match(countQuery, /status: 'SUBMITTED'/);
  assert.doesNotMatch(countQuery, /weekStart:/);
});
