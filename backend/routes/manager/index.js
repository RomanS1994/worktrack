import { handleManagerAudit } from './audit.js';
import {
  handleManagerOrderDetail,
  handleManagerOrders,
  handleManagerOrderRestore,
} from './orders.js';
import {
  handleManagerPlanCreate,
  handleManagerPlansList,
  handleManagerPlanUpdate,
} from './plans.js';
import { handleManagerUserRole } from './roles.js';
import {
  handleManagerUserCancel,
  handleManagerUserConfirmSubscription,
  handleManagerUserExtend,
  handleManagerUserSubscription,
} from './subscriptions.js';
import {
  handleManagerUserDetail,
  handleManagerUserList,
} from './users.js';

export async function handleManagerRoutes(request, response, { pathName, url }) {
  if (request.method === 'GET' && pathName === '/api/manager/users') {
    await handleManagerUserList(request, response, url);
    return true;
  }

  const managerUserMatch = pathName.match(/^\/api\/manager\/users\/([^/]+)$/);
  if (request.method === 'GET' && managerUserMatch) {
    await handleManagerUserDetail(request, response, managerUserMatch[1]);
    return true;
  }

  const managerSubscriptionMatch = pathName.match(
    /^\/api\/manager\/users\/([^/]+)\/subscription$/
  );
  if (request.method === 'PATCH' && managerSubscriptionMatch) {
    await handleManagerUserSubscription(request, response, managerSubscriptionMatch[1]);
    return true;
  }

  const managerExtendMatch = pathName.match(
    /^\/api\/manager\/users\/([^/]+)\/subscription\/extend$/
  );
  if (request.method === 'POST' && managerExtendMatch) {
    await handleManagerUserExtend(request, response, managerExtendMatch[1]);
    return true;
  }

  const managerCancelMatch = pathName.match(
    /^\/api\/manager\/users\/([^/]+)\/subscription\/cancel$/
  );
  if (request.method === 'POST' && managerCancelMatch) {
    await handleManagerUserCancel(request, response, managerCancelMatch[1]);
    return true;
  }

  const managerConfirmMatch = pathName.match(
    /^\/api\/manager\/users\/([^/]+)\/subscription\/confirm-payment$/
  );
  if (request.method === 'POST' && managerConfirmMatch) {
    await handleManagerUserConfirmSubscription(request, response, managerConfirmMatch[1]);
    return true;
  }

  const managerRoleMatch = pathName.match(/^\/api\/manager\/users\/([^/]+)\/role$/);
  if (request.method === 'PATCH' && managerRoleMatch) {
    await handleManagerUserRole(request, response, managerRoleMatch[1]);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/plans') {
    await handleManagerPlansList(request, response);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/orders') {
    await handleManagerOrders(request, response, url);
    return true;
  }

  const managerOrderMatch = pathName.match(/^\/api\/manager\/orders\/([^/]+)$/);
  if (request.method === 'GET' && managerOrderMatch) {
    await handleManagerOrderDetail(request, response, managerOrderMatch[1], url);
    return true;
  }

  const managerOrderRestoreMatch = pathName.match(
    /^\/api\/manager\/orders\/([^/]+)\/restore$/
  );
  if (request.method === 'POST' && managerOrderRestoreMatch) {
    await handleManagerOrderRestore(request, response, managerOrderRestoreMatch[1]);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/manager/plans') {
    await handleManagerPlanCreate(request, response);
    return true;
  }

  const managerPlanMatch = pathName.match(/^\/api\/manager\/plans\/([^/]+)$/);
  if (request.method === 'PATCH' && managerPlanMatch) {
    await handleManagerPlanUpdate(request, response, managerPlanMatch[1]);
    return true;
  }

  if (request.method === 'GET' && pathName === '/api/manager/audit') {
    await handleManagerAudit(request, response, url);
    return true;
  }

  return false;
}
