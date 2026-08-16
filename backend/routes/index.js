import { handleAuthRoutes } from './auth/index.js';
import { handleMeRoutes } from './me.js';
import { handlePublicRoutes } from './public.js';

const routeHandlers = [
  handlePublicRoutes,
  handleAuthRoutes,
  handleMeRoutes,
];

export async function routeRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const context = {
    url,
    pathName: url.pathname,
  };

  for (const handleRoute of routeHandlers) {
    if (await handleRoute(request, response, context)) {
      return;
    }
  }

  throw new Error('Route not found');
}
