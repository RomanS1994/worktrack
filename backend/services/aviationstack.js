import { nowIso } from '../validation/common.js';

const DEFAULT_BASE_URL = 'https://api.aviationstack.com/v1';
const DEFAULT_TIMEOUT_MS = 6000;
const FALLBACK_FLIGHTS_LIMIT = 10;

// Нормалізує номер рейсу для запиту до Aviationstack.
function normalizeFlightNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Додає пробіл між кодом авіакомпанії та номером рейсу.
function formatFlightNumber(value) {
  const normalized = normalizeFlightNumber(value);

  if (!normalized) {
    return '';
  }

  return normalized.replace(/^([A-Z0-9]{2})(\d.*)$/, '$1 $2');
}

// Перетворює часовий рядок провайдера на ISO.
function toIsoString(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

// Повертає лише додатне ціле число.
function toPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// Додає хвилини до ISO-часу.
function addMinutes(isoValue, minutes) {
  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime()) || !minutes) {
    return '';
  }

  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

// Читає секретний API key лише на backend.
function getAviationstackApiKey() {
  return String(process.env.AVIATIONSTACK_API_KEY || '').trim();
}

// Повертає налаштований або стандартний URL провайдера.
function getAviationstackBaseUrl() {
  return String(process.env.AVIATIONSTACK_BASE_URL || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
}

// Повертає timeout зовнішнього HTTP-запиту.
function getAviationstackTimeoutMs() {
  const configured = Number.parseInt(String(process.env.AVIATIONSTACK_TIMEOUT_MS || ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

// Визначає, чи можна передавати plan-specific параметр flight_date.
function shouldUseFlightDateFilter() {
  // За замовчуванням вимкнено, щоб не робити платний fallback-запит.
  return String(process.env.AVIATIONSTACK_USE_FLIGHT_DATE_FILTER || '')
    .trim()
    .toLowerCase() === 'true';
}

// Нормалізує дату рейсу до YYYY-MM-DD.
function normalizeFlightDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : '';
}

// Дістає дату з рядка або Date-сумісного значення.
function getDatePart(value) {
  const text = String(value || '').trim();
  const directDate = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (directDate) {
    return directDate[1];
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

// Будує URL одного запиту без автоматичних повторів.
function buildFlightsUrl(flightNumber, { flightDate = '', includeFlightDate = true, limit = 1 } = {}) {
  const baseUrl = getAviationstackBaseUrl().replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/flights`);

  url.searchParams.set('access_key', getAviationstackApiKey());
  url.searchParams.set('flight_iata', normalizeFlightNumber(flightNumber));
  url.searchParams.set('limit', String(limit));

  const normalizedFlightDate = normalizeFlightDate(flightDate);

  if (includeFlightDate && normalizedFlightDate) {
    url.searchParams.set('flight_date', normalizedFlightDate);
  }

  return url;
}

// Перетворює API-помилку провайдера на стандартний Error.
function createAviationstackError(payload) {
  const message = payload?.error?.info || payload?.error?.message || 'aviationstack API error';
  const error = new Error(message);
  error.code = payload?.error?.code || '';
  return error;
}

// Перетворює статус Aviationstack на внутрішній статус застосунку.
function normalizeFlightStatus(value, arrivalDelay) {
  const status = String(value || '').trim().toLowerCase();

  if (status === 'landed') return 'landed';
  if (status === 'cancelled') return 'cancelled';
  if (arrivalDelay > 0) return 'delayed';
  if (status === 'active') return 'in_air';
  if (status === 'scheduled') return 'scheduled';

  return 'unknown';
}

// Визначає дату конкретного запису рейсу.
function getFlightRecordDate(record) {
  const arrival = record?.arrival && typeof record.arrival === 'object' ? record.arrival : {};
  const departure = record?.departure && typeof record.departure === 'object' ? record.departure : {};

  return (
    getDatePart(arrival.scheduled) ||
    getDatePart(departure.scheduled) ||
    getDatePart(arrival.estimated) ||
    getDatePart(departure.estimated)
  );
}

// Обирає запис, який відповідає потрібній даті рейсу.
function selectFlightRecord(records, { flightDate = '' } = {}) {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  const normalizedFlightDate = normalizeFlightDate(flightDate);

  if (!normalizedFlightDate) {
    return records[0];
  }

  return records.find(record => getFlightRecordDate(record) === normalizedFlightDate) || null;
}

// Нормалізує відповідь провайдера для frontend і кешу.
export function normalizeAviationstackFlight(record, fallbackFlightNumber) {
  if (!record || typeof record !== 'object') {
    return {
      status: 'unknown',
      flightNumber: formatFlightNumber(fallbackFlightNumber),
      route: {
        from: '',
        to: '',
        fromCode: '',
        toCode: '',
      },
      scheduledArrival: '',
      estimatedArrival: '',
      actualArrival: '',
      delayMinutes: 0,
      terminal: '',
      baggageClaim: '',
      updatedAt: nowIso(),
    };
  }

  const arrival = record.arrival && typeof record.arrival === 'object' ? record.arrival : {};
  const departure = record.departure && typeof record.departure === 'object' ? record.departure : {};
  const flight = record.flight && typeof record.flight === 'object' ? record.flight : {};
  const arrivalDelay = toPositiveInteger(arrival.delay);
  const scheduledArrival = toIsoString(arrival.scheduled);
  const estimatedArrival =
    toIsoString(arrival.estimated) ||
    toIsoString(arrival.estimated_runway) ||
    addMinutes(scheduledArrival, arrivalDelay);
  const actualArrival = toIsoString(arrival.actual) || toIsoString(arrival.actual_runway);

  return {
    status: normalizeFlightStatus(record.flight_status, arrivalDelay),
    flightNumber: formatFlightNumber(flight.iata || fallbackFlightNumber),
    route: {
      from: String(departure.airport || departure.iata || '').trim(),
      to: String(arrival.airport || arrival.iata || '').trim(),
      fromCode: String(departure.iata || '').trim().toUpperCase(),
      toCode: String(arrival.iata || '').trim().toUpperCase(),
    },
    scheduledArrival,
    estimatedArrival,
    actualArrival,
    delayMinutes: arrivalDelay,
    terminal: String(arrival.terminal || '').trim(),
    baggageClaim: String(arrival.baggage || '').trim(),
    updatedAt: nowIso(),
  };
}

// Виконує один HTTP-запит і повертає нормалізований статус.
async function requestFlightStatus(flightNumber, options, signal) {
  const response = await fetch(buildFlightsUrl(flightNumber, options), {
    method: 'GET',
    signal,
  });
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload?.error) {
    throw createAviationstackError(payload);
  }

  if (!response.ok) {
    throw new Error(`aviationstack request failed with ${response.status}`);
  }

  const flight = selectFlightRecord(payload?.data, options);
  if (!flight) {
    return null;
  }

  return normalizeAviationstackFlight(flight, flightNumber);
}

// Завантажує статус рейсу з timeout без платного retry/fallback.
export async function fetchAviationstackFlightStatus(flightNumber, { flightDate = '' } = {}) {
  const normalizedFlightNumber = normalizeFlightNumber(flightNumber);

  if (!getAviationstackApiKey() || !normalizedFlightNumber) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAviationstackTimeoutMs());
  const normalizedFlightDate = normalizeFlightDate(flightDate);
  const includeFlightDate = shouldUseFlightDateFilter();

  try {
    return await requestFlightStatus(
      normalizedFlightNumber,
      {
        flightDate: normalizedFlightDate,
        includeFlightDate,
        limit: includeFlightDate ? 1 : FALLBACK_FLIGHTS_LIMIT,
      },
      controller.signal
    );
  } finally {
    clearTimeout(timeout);
  }
}
