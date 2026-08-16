import { RUNTIME_ENV_GROUPS } from './constants.js';
import { isPlaceholderDatabaseUrl, isPlaceholderLike } from './helpers.js';
import { getRuntimeEnvSnapshot } from './read.js';

export function validateRuntimeEnv() {
  const errors = [];
  const {
    authTokenSecret,
    apiKey,
    databaseUrl,
    directDatabaseUrl,
  } = getRuntimeEnvSnapshot();

  if (!authTokenSecret) {
    errors.push('AUTH_TOKEN_SECRET is required.');
  } else {
    if (isPlaceholderLike(authTokenSecret)) {
      errors.push('AUTH_TOKEN_SECRET must not use an example or placeholder value.');
    }
    if (authTokenSecret.length < 32) {
      errors.push('AUTH_TOKEN_SECRET must be at least 32 characters long.');
    }
  }

  if (apiKey && isPlaceholderLike(apiKey)) {
    errors.push('API_KEY must be empty or a real value, not a placeholder.');
  }

  if (apiKey && authTokenSecret && apiKey === authTokenSecret) {
    errors.push('API_KEY must not match AUTH_TOKEN_SECRET.');
  }

  if (!databaseUrl && !directDatabaseUrl) {
    errors.push('DATABASE_URL or DIRECT_DATABASE_URL is required for Prisma/PostgreSQL.');
  }

  if (databaseUrl && isPlaceholderDatabaseUrl(databaseUrl)) {
    errors.push('DATABASE_URL must not use example placeholder credentials.');
  }

  if (directDatabaseUrl && isPlaceholderDatabaseUrl(directDatabaseUrl)) {
    errors.push('DIRECT_DATABASE_URL must not use example placeholder credentials.');
  }

  return {
    ok: errors.length === 0,
    errors,
    groups: RUNTIME_ENV_GROUPS,
  };
}

export function assertRuntimeEnv() {
  const validation = validateRuntimeEnv();
  if (validation.ok) {
    return validation;
  }

  const message = [
    'Invalid backend environment configuration.',
    ...validation.errors.map(error => `- ${error}`),
    '',
    'Environment groups:',
    `- auth: ${validation.groups.auth.join(', ')}`,
    `- api: ${validation.groups.api.join(', ')}`,
    `- database: ${validation.groups.database.join(', ')}`,
    `- frontend: ${validation.groups.frontend.join(', ')} (root .env only, not backend/.env)`,
  ].join('\n');

  throw new Error(message);
}
