import { DEFAULT_ACCESS_TOKEN_TTL_MINUTES } from './constants.js';
import { isPlaceholderLike, normalizeEnvValue } from './helpers.js';

export function isProductionEnvironment() {
  return normalizeEnvValue(process.env.NODE_ENV) === 'production';
}

export function getAuthTokenSecret() {
  const authTokenSecret = normalizeEnvValue(process.env.AUTH_TOKEN_SECRET);

  if (!authTokenSecret || isPlaceholderLike(authTokenSecret)) {
    throw new Error(
      'AUTH_TOKEN_SECRET is required and must be a real secret value.'
    );
  }

  return authTokenSecret;
}

export function getApiKey() {
  return normalizeEnvValue(process.env.API_KEY);
}

export function getDatabaseUrl() {
  return normalizeEnvValue(process.env.DATABASE_URL);
}

export function getDirectDatabaseUrl() {
  return normalizeEnvValue(process.env.DIRECT_DATABASE_URL);
}

export function getAccessTokenTtlMinutes() {
  return Number(process.env.ACCESS_TOKEN_TTL_MINUTES || DEFAULT_ACCESS_TOKEN_TTL_MINUTES);
}

export function getRuntimeEnvSnapshot() {
  return {
    authTokenSecret: normalizeEnvValue(process.env.AUTH_TOKEN_SECRET),
    apiKey: getApiKey(),
    databaseUrl: getDatabaseUrl(),
    directDatabaseUrl: getDirectDatabaseUrl(),
    productionEnvironment: isProductionEnvironment(),
  };
}
