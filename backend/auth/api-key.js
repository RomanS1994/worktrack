import { getApiKey } from '../config/runtime-env.js';
import { sendError } from '../lib/http.js';

export function requireApiKey(request, response) {
  const apiKey = getApiKey();

  if (!apiKey) return true;

  if (request.headers['x-api-key'] !== apiKey) {
    sendError(response, 401, 'Invalid API key');
    return false;
  }

  return true;
}
