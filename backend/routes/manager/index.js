import { requireManager } from '../../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { deleteManagerEmployee, restoreDeletedManagerEmployee } from '../../services/deletion.js';
import { getManagerEmployees } from '../../services/manager-employees.js';
import { resetEmployeePassword } from '../../services/employee-password-reset.js';
import { getManagerPayroll } from '../../services/manager-payroll.js';
import { getManagerTimesheet, upsertManagerTimesheetCell } from '../../services/manager-timesheet.js';
import { notifyEmployeeAboutReview } from '../../services/notifications.js';
import { calculateNetWorkEntries, calculateNetWorkSummary } from '../../services/work-time-calculation.js';
import {
  createManagerEmployee,
  getManagerSubmissionById,
  listManagerSubmissions,
  reviewWeeklySubmission,
  updateEmployeeMembership,
} from '../../services/worktrack.js';

async function enrichSubmissionHours(client, context, submissions) {
  const list = Array.isArray(submissions) ? submissions : [submissions].filter(Boolean);
  if (!list.length) return list;

  const rulesRow = await client.company.findUnique({
    where: { id: context.activeMembership.companyId },
    select: { breakMinutes: true, standardDailyHours: true },
  });
  const rules = {
    breakMinutes: Number(rulesRow?.breakMinutes || 0),
    standardDailyHours: Number(rulesRow?.standardDailyHours || 8),
  };
  const entryIds = list.flatMap(submission => (submission.entries || []).map(entry => entry.id)).filter(Boolean);
  const storedEntries = entryIds.length
    ? await client.workEntry.findMany({
        where: { id: { in: entryIds }, companyId: context.activeMembership.companyId },
        select: {
          id: true,
          grossHours: true,
          breakMinutes: true,
          hourlyRateCzk: true,
          startTime: true,
          endTime: true,
          note: true,
        },
      })
    : [];
  const storedById = new Map(storedEntries.map(entry => [entry.id, entry]));

  return list.map(submission => {
    const sourceEntries = (submission.entries || []).map(entry => {
      const stored = storedById.get(entry.id);
      return {
        ...entry,
        grossHours: stored?.grossHours == null ? null : String(stored.grossHours),
        breakMinutes: stored?.breakMinutes == null ? null : Number(stored.breakMinutes),
        hourlyRateCzk: stored?.hourlyRateCzk == null ? null : String(stored.hourlyRateCzk),
        startTime: stored?.startTime || null,
        endTime: stored?.endTime || null,
        note: stored?.note || '',
      };
    });
    const normalizedEntries = calculateNetWorkEntries(sourceEntries, rules);
    const summary = calculateNetWorkSummary(
      sourceEntries,
      submission.employee?.hourlyRateCzk || 0,
      rules
    );
    return {
      ...submission,
      entries: normalizedEntries.map(entry => ({
        ...entry,
        hours: entry.netHours,
        netHours: entry.netHours,
      })),
      summary,
      workRules: {
        breakMinutes: rules.breakMinutes,
        standardDailyHours: rules.standardDailyHours.toFixed(2),
      },
    };
  });
}

export async function handleManagerRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/manager/timesheet') {
    const context = await requireManager(request, response); if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getManagerTimesheet(client, context, { month: url.searchParams.get('month') }) });
    sendJson(response, 200, payload); return true;
  }

  const timesheetCellMatch = pathName.match(/^\/api\/manager\/timesheet\/([^/]+)$/);
  if (request.method === 'PUT' && timesheetCellMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({ prisma: client => upsertManagerTimesheetCell(client, context, timesheetCellMatch[1], body) });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/payroll') {
    const context = await requireManager(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getManagerPayroll(client, context, { period: url.searchParams.get('period'), anchor: url.searchParams.get('anchor') }) });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/employees') {
    const context = await requireManager(request, response); if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getManagerEmployees(client, context) });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'POST' && pathName === '/api/manager/employees') {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const employee = await runStoreTransaction({
      prisma: async client =>
        (await restoreDeletedManagerEmployee(client, context, body)) ||
        createManagerEmployee(client, context, body),
    });
    sendJson(response, 201, { employee }); return true;
  }

  const passwordResetMatch = pathName.match(/^\/api\/manager\/employees\/([^/]+)\/reset-password$/);
  if (request.method === 'POST' && passwordResetMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const result = await runStoreTransaction({ prisma: client => resetEmployeePassword(client, context, passwordResetMatch[1], body) });
    sendJson(response, 200, result); return true;
  }

  const employeeMatch = pathName.match(/^\/api\/manager\/employees\/([^/]+)$/);
  if (request.method === 'PATCH' && employeeMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const employee = await runStoreTransaction({ prisma: client => updateEmployeeMembership(client, context, employeeMatch[1], body) });
    sendJson(response, 200, { employee }); return true;
  }

  if (request.method === 'DELETE' && employeeMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const result = await runStoreTransaction({ prisma: client => deleteManagerEmployee(client, context, employeeMatch[1]) });
    sendJson(response, 200, result); return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/submissions') {
    const context = await requireManager(request, response); if (!context) return true;
    const payload = await runStoreRead({ prisma: async client => {
      const raw = await listManagerSubmissions(client, context, { status: url.searchParams.get('status') });
      return { submissions: await enrichSubmissionHours(client, context, raw.submissions) };
    } });
    sendJson(response, 200, payload); return true;
  }

  const managerEntryMatch = pathName.match(/^\/api\/manager\/work-entries\/([^/]+)$/);
  if (request.method === 'DELETE' && managerEntryMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const result = await runStoreTransaction({ prisma: async client => {
      const manager = context.activeMembership || context.membership || context;
      const entry = await client.workEntry.findFirst({ where: { id: managerEntryMatch[1], companyId: manager.companyId }, include: { weeklySubmission: true } });
      if (!entry) throw new Error('Work entry not found');
      const submissionId = entry.weeklySubmissionId;
      await client.workEntry.delete({ where: { id: entry.id } });
      if (submissionId) {
        const remaining = await client.workEntry.count({ where: { weeklySubmissionId: submissionId } });
        if (!remaining) await client.weeklySubmission.delete({ where: { id: submissionId } });
      }
      return { ok: true, submissionId };
    } });
    sendJson(response, 200, result); return true;
  }

  const clearSubmissionMatch = pathName.match(/^\/api\/manager\/submissions\/([^/]+)\/clear$/);
  if (request.method === 'DELETE' && clearSubmissionMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const result = await runStoreTransaction({ prisma: async client => {
      const manager = context.activeMembership || context.membership || context;
      const submission = await client.weeklySubmission.findFirst({ where: { id: clearSubmissionMatch[1], companyId: manager.companyId } });
      if (!submission) throw new Error('Weekly submission not found');
      const deleted = await client.workEntry.deleteMany({ where: { companyId: manager.companyId, weeklySubmissionId: submission.id } });
      await client.weeklySubmission.delete({ where: { id: submission.id } });
      return { ok: true, deletedEntries: deleted.count };
    } });
    sendJson(response, 200, result); return true;
  }

  const submissionMatch = pathName.match(/^\/api\/manager\/submissions\/([^/]+)$/);
  if (request.method === 'GET' && submissionMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const submission = await runStoreRead({ prisma: async client => {
      const raw = await getManagerSubmissionById(client, context, submissionMatch[1]);
      const [enriched] = await enrichSubmissionHours(client, context, raw);
      return enriched;
    } });
    sendJson(response, 200, { submission }); return true;
  }

  const approvalMatch = pathName.match(/^\/api\/manager\/submissions\/([^/]+)\/(approve|reject)$/);
  if (request.method === 'POST' && approvalMatch) {
    const context = await requireManager(request, response); if (!context) return true;
    const decision = approvalMatch[2];
    const body = decision === 'reject' ? await readJsonBody(request) : {};
    const rejectionReason = String(body?.rejectionReason || '').trim();
    if (decision === 'reject' && !rejectionReason) throw new Error('Rejection reason is required');
    if (rejectionReason.length > 500) throw new Error('Rejection reason must be 500 characters or fewer');
    const submission = await runStoreTransaction({ prisma: async client => {
      const reviewedSubmission = await reviewWeeklySubmission(client, context, approvalMatch[1], decision, { rejectionReason });
      await notifyEmployeeAboutReview(client, context, reviewedSubmission);
      return reviewedSubmission;
    } });
    sendJson(response, 200, { submission }); return true;
  }

  return false;
}
