export const FLIGHT_STATUS_VALUES = new Set([
  'landed',
  'delayed',
  'in_air',
  'scheduled',
  'cancelled',
  'unknown',
]);

export const FLIGHT_STATUS_PLAN_ID = 'plan-100';

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function hasFlightStatusAccess(user) {
  const planId = user?.subscription?.planId || user?.subscription?.plan?.id || user?.planId || '';
  const status = user?.subscription?.status || user?.usage?.status || '';

  return planId === FLIGHT_STATUS_PLAN_ID && (!status || status === 'active' || status === 'trial');
}

export function getFlightStatusFromMetadata(metadata) {
  if (!isPlainObject(metadata)) {
    return null;
  }

  const flightStatus = metadata.flightStatus;

  if (!isPlainObject(flightStatus)) {
    return null;
  }

  const status = String(flightStatus.status || '').trim().toLowerCase();

  return {
    ...flightStatus,
    status: FLIGHT_STATUS_VALUES.has(status) ? status : 'unknown',
  };
}

export function normalizeOrderMetadata(metadata, { includeFlightStatus = false } = {}) {
  if (!isPlainObject(metadata)) {
    return {};
  }

  const normalizedMetadata = { ...metadata };
  delete normalizedMetadata.flightStatus;

  if (!includeFlightStatus) {
    return normalizedMetadata;
  }

  const flightStatus = getFlightStatusFromMetadata(metadata);

  if (!flightStatus) {
    return normalizedMetadata;
  }

  return {
    ...normalizedMetadata,
    flightStatus,
  };
}
