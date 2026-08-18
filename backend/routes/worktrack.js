import { getAuthContext, requireEmployee } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { getManagerDashboard } from '../services/manager-dashboard.js';
import { notifyManagersAboutSubmission } from '../services/notifications.js';
import {
  createEmployeeWorkEntry,
  createProject,
  deactivateProject,
  deleteEmployeeWorkEntry,
  getCompanySettings,
  getEmployeeDashboardSummary,
  getEmployeeWeek,
  listProjects,
  submitEmployeeWeek,
  updateCompanySettings,
  updateEmployeeWorkEntry,
  updateProject,
} from '../services/worktrack.js';

async function getAuthenticatedContext(request, response) {
  const context = await getAuthContext(request, response);
  return context || null;
}

export async function handleWorkTrackRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/projects') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client => listProjects(client, context),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/projects') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const project = await runStoreTransaction({
      prisma: client => createProject(client, context, body),
    });
    sendJson(response, 201, { project });
    return true;
  }

  const projectMatch = pathName.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === 'PATCH' && projectMatch) {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const project = await runStoreTransaction({
      prisma: client => updateProject(client, context, projectMatch[1], body),
    });
    sendJson(response, 200, { project });
    return true;
  }

  const deactivateProjectMatch = pathName.match(/^\/api\/projects\/([^/]+)\/deactivate$/);
  if (request.method === 'POST' && deactivateProjectMatch) {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const project = await runStoreTransaction({
      prisma: client => deactivateProject(client, context, deactivateProjectMatch[1]),
    });
    sendJson(response, 200, { project });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/company-settings') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client => getCompanySettings(client, context),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'PATCH' && pathName === '/api/company-settings') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const payload = await runStoreTransaction({
      prisma: client => updateCompanySettings(client, context, body),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/work-entries') {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client => getEmployeeWeek(client, context, url.searchParams.get('weekStart')),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/work-entries') {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const entry = await runStoreTransaction({
      prisma: client => createEmployeeWorkEntry(client, context, body),
    });
    sendJson(response, 201, { entry });
    return true;
  }

  const workEntryMatch = pathName.match(/^\/api\/work-entries\/([^/]+)$/);
  if (request.method === 'PATCH' && workEntryMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const entry = await runStoreTransaction({
      prisma: client => updateEmployeeWorkEntry(client, context, workEntryMatch[1], body),
    });
    sendJson(response, 200, { entry });
    return true;
  }

  if (request.method === 'DELETE' && workEntryMatch) {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const payload = await runStoreTransaction({
      prisma: client => deleteEmployeeWorkEntry(client, context, workEntryMatch[1]),
    });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/weekly-submissions') {
    const context = await requireEmployee(request, response);
    if (!context) return true;

    const body = await readJsonBody(request);
    const submission = await runStoreTransaction({
      prisma: async client => {
        const createdSubmission = await submitEmployeeWeek(client, context, body);
        await notifyManagersAboutSubmission(client, context, createdSubmission);
        return createdSubmission;
      },
    });
    sendJson(response, 201, { submission });
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/work-summary') {
    const context = await getAuthenticatedContext(request, response);
    if (!context) return true;

    const payload = await runStoreRead({
      prisma: client =>
        context.activeMembership?.role === 'MANAGER'
          ? getManagerDashboard(client, context)
          : getEmployeeDashboardSummary(client, context, url.searchParams.get('weekStart')),
    });
    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
