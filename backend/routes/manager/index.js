import { requireManager } from '../../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../../db/store.js';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { resetEmployeePassword } from '../../services/employee-password-reset.js';
import { getManagerPayroll } from '../../services/manager-payroll.js';
import { notifyEmployeeAboutReview } from '../../services/notifications.js';
import {
  createManagerEmployee,
  getManagerSubmissionById,
  listManagerEmployees,
  listManagerSubmissions,
  reviewWeeklySubmission,
  updateEmployeeMembership,
} from '../../services/worktrack.js';

export async function handleManagerRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/manager/payroll') {
    const context = await requireManager(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => getManagerPayroll(client, context, { period: url.searchParams.get('period'), anchor: url.searchParams.get('anchor') }) });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/employees') {
    const context = await requireManager(request, response); if (!context) return true;
    const payload = await runStoreRead({ prisma: client => listManagerEmployees(client, context) });
    sendJson(response, 200, payload); return true;
  }

  if (request.method === 'POST' && pathName === '/api/manager/employees') {
    const context = await requireManager(request, response); if (!context) return true;
    const body = await readJsonBody(request);
    const employee = await runStoreTransaction({ prisma: client => createManagerEmployee(client, context, body) });
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

  if (request.method === 'GET' && pathName === '/api/manager/submissions') {
    const context = await requireManager(request, response); if (!context) return true;
    const payload = await runStoreRead({ prisma: client => listManagerSubmissions(client, context, { status: url.searchParams.get('status') }) });
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
    const submission = await runStoreRead({ prisma: client => getManagerSubmissionById(client, context, submissionMatch[1]) });
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
