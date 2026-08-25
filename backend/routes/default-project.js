import { getAuthContext } from '../auth/context.js';
import { runStoreRead, runStoreTransaction } from '../db/store.js';
import { readJsonBody, sendJson } from '../lib/http.js';

function normalizeProfile(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getDefaultProjects(profile) {
  const value = normalizeProfile(profile).defaultProjects;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function loadDefaultProject(client, context) {
  const companyId = context.activeMembership?.companyId;
  if (!companyId) return { projectId: '', project: null };

  const projectId = String(getDefaultProjects(context.user.profile)[companyId] || '');
  if (!projectId) return { projectId: '', project: null };

  const project = await client.project.findFirst({
    where: { id: projectId, companyId, isActive: true },
    select: { id: true, name: true, address: true, isActive: true },
  });

  return project ? { projectId: project.id, project } : { projectId: '', project: null };
}

export async function handleDefaultProjectRoutes(request, response, { pathName }) {
  if (pathName !== '/api/default-project') return false;

  const context = await getAuthContext(request, response);
  if (!context) return true;

  if (request.method === 'GET') {
    const payload = await runStoreRead({ prisma: client => loadDefaultProject(client, context) });
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === 'PATCH') {
    const body = await readJsonBody(request);
    const projectId = String(body.projectId || '').trim();
    if (!projectId) throw new Error('Project is required');

    const payload = await runStoreTransaction({
      prisma: async client => {
        const companyId = context.activeMembership?.companyId;
        if (!companyId) throw new Error('Active company is required');

        const project = await client.project.findFirst({
          where: { id: projectId, companyId, isActive: true },
          select: { id: true, name: true, address: true, isActive: true },
        });
        if (!project) throw new Error('Project not found');

        const profile = normalizeProfile(context.user.profile);
        await client.user.update({
          where: { id: context.user.id },
          data: {
            profile: {
              ...profile,
              defaultProjects: {
                ...getDefaultProjects(profile),
                [companyId]: project.id,
              },
            },
          },
        });

        return { projectId: project.id, project };
      },
    });

    sendJson(response, 200, payload);
    return true;
  }

  return false;
}
