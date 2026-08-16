export const DEFAULT_ACCESS_TOKEN_TTL_MINUTES = 1440;

export const EXACT_PLACEHOLDER_VALUES = new Set([
  '',
  'user',
  'username',
  'password',
  'pass',
  'host',
  'hostname',
  'database',
  'db',
]);

export const PLACEHOLDER_FRAGMENTS = [
  'change-me',
  'changeme',
  'example',
  'placeholder',
  'replace-with',
  'your-',
  'your_',
  'dummy',
  'sample',
];

export const RUNTIME_ENV_GROUPS = {
  auth: ['AUTH_TOKEN_SECRET', 'ACCESS_TOKEN_TTL_MINUTES', 'REFRESH_*'],
  api: ['API_KEY'],
  database: ['DATABASE_URL', 'DIRECT_DATABASE_URL'],
  frontend: ['VITE_API_BASE_URL', 'VITE_API_KEY'],
};
