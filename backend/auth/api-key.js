import { getApiKey } from '../config/runtime-env.js';
import { sendError } from '../lib/http.js';

export function requireApiKey(request, response) {
  const apiKey = getApiKey();
  const pathName = request.url?.split('?')[0];

  if (pathName === '/api/health') return true;

  if (!apiKey) return true;

  if (request.headers['x-api-key'] !== apiKey) {
    sendError(response, 401, 'Invalid API key');
    return false;
  }

  return true;
}
