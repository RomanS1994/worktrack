import { handleAuthRoutes } from './auth/index.js';
import { handleBillingRoutes } from './billing.js';
import { handleDefaultProjectRoutes } from './default-project.js';
import { handleManagerRoutes } from './manager/index.js';
import { handleMeRoutes } from './me.js';
import { handleMonthlyHoursRoutes } from './monthly-hours.js';
import { handleNotificationRoutes } from './notifications.js';
import { handlePublicRoutes } from './public.js';
import { handleWorkRulesRoutes } from './work-rules.js';
import { handleWorkTrackRoutes } from './worktrack.js';

const routeHandlers = [
  handlePublicRoutes,
  handleAuthRoutes,
  handleMeRoutes,
  handleNotificationRoutes,
  handleBillingRoutes,
  handleDefaultProjectRoutes,
  handleWorkRulesRoutes,
  handleMonthlyHoursRoutes,
  handleWorkTrackRoutes,
  handleManagerRoutes,
];

export async function routeRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const context = { url, pathName: url.pathname };

  for (const handleRoute of routeHandlers) {
    if (await handleRoute(request, response, context)) return;
  }

  throw new Error('Route not found');
}
