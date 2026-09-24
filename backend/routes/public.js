import { getDatabaseHealth } from '../db/store.js';
import { sendJson } from '../lib/http.js';
import { prisma } from '../db/prisma.js';
import { sendUserAvatar } from '../services/avatars.js';
import { nowIso } from '../validation/common.js';

export function getDeploymentMetadata() {
  return {
    provider: process.env.RENDER === 'true' ? 'render' : 'local',
    branch: process.env.RENDER_GIT_BRANCH || '',
    commit: process.env.RENDER_GIT_COMMIT || '',
    externalUrl: process.env.RENDER_EXTERNAL_URL || '',
  };
}

export async function handlePublicRoutes(request, response, { pathName }) {
  const avatarMatch = pathName.match(/^\/api\/avatars\/([^/]+)\/([a-f0-9]{24})$/);
  if (request.method === 'GET' && avatarMatch) {
    await sendUserAvatar(
      prisma,
      response,
      decodeURIComponent(avatarMatch[1]),
      avatarMatch[2],
    );
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/health') {
    const health = await getDatabaseHealth();

    sendJson(response, health.ok ? 200 : 503, {
      ok: health.ok,
      database: health.database,
      deployment: getDeploymentMetadata(),
      error: health.error || null,
      time: nowIso(),
    });
    return true;
  }

  return false;
}
