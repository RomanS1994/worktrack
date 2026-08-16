import { handleLogin } from './login.js';
import { handleLogout } from './logout.js';
import { handleRefresh } from './refresh.js';
import { handleRegister } from './register.js';

export async function handleAuthRoutes(request, response, { pathName }) {
  if (request.method === 'POST' && pathName === '/api/auth/register') {
    await handleRegister(request, response);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/auth/login') {
    await handleLogin(request, response);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/auth/refresh') {
    await handleRefresh(request, response);
    return true;
  }

  if (request.method === 'POST' && pathName === '/api/auth/logout') {
    await handleLogout(request, response);
    return true;
  }

  return false;
}
