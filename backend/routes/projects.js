import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';
import { deleteProject } from '../services/deletion.js';
import {
  createProject,
  deactivateProject,
  listProjects,
  updateProject,
} from '../services/projects.js';

async function auth(request, response) {
  return (await getAuthContext(request, response)) || null;
}

export async function handleProjectRoutes(request, response, { pathName }) {
  if (request.method === 'GET' && pathName === '/api/projects') {
    const context = await auth(request, response);
    if (!context) return true;
    const payload = await runStoreRead({ prisma: client => listProjects(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/projects') {
    const context = await auth(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const project = await runStoreTransaction({ prisma: client => createProject(client, context, body) });
    sendJson(response, 201, { project });
    return true;
  }

  const projectMatch = pathName.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === 'PATCH' && projectMatch) {
    const context = await auth(request, response);
    if (!context) return true;
    const body = await readJsonBody(request);
    const project = await runStoreTransaction({
      prisma: client => updateProject(client, context, projectMatch[1], body),
    });
    sendJson(response, 200, { project });
    return true;
  }

  if (request.method === 'DELETE' && projectMatch) {
    const context = await auth(request, response);
    if (!context) return true;
    const payload = await runStoreTransaction({
      prisma: client => deleteProject(client, context, projectMatch[1]),
    });
    sendJson(response, 200, payload);
    return true;
  }

  const deactivateMatch = pathName.match(/^\/api\/projects\/([^/]+)\/deactivate$/);
  if (request.method === 'POST' && deactivateMatch) {
    const context = await auth(request, response);
    if (!context) return true;
    const project = await runStoreTransaction({
      prisma: client => deactivateProject(client, context, deactivateMatch[1]),
    });
    sendJson(response, 200, { project });
    return true;
  }

  return false;
}
