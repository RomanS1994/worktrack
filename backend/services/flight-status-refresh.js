import { fetchAviationstackFlightStatus } from './aviationstack.js';
import {
  getCachedOrRefreshFlightStatus,
  getFlightCacheKey,
} from './flight-status-cache.js';

const MIN_CACHE_TTL_MINUTES = 15;
const DEFAULT_CACHE_TTL_MINUTES = 15;
const DEFAULT_MAX_REFRESH_PER_REQUEST = 8;

// Перевіряє, що значення є звичайним об’єктом.
function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

// Повертає TTL локального order-кешу з мінімумом 15 хвилин.
function getCacheTtlMs() {
  const minutes = Number.parseInt(String(process.env.AVIATIONSTACK_CACHE_TTL_MINUTES || ''), 10);
  return Math.max(
    MIN_CACHE_TTL_MINUTES,
    Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CACHE_TTL_MINUTES
  ) * 60 * 1000;
}

// Обмежує кількість різних рейсів, що оновлюються одним HTTP-запитом.
function getMaxRefreshPerRequest() {
  const value = Number.parseInt(String(process.env.AVIATIONSTACK_MAX_REFRESH_PER_REQUEST || ''), 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_REFRESH_PER_REQUEST;
}

// Дістає та нормалізує номер рейсу із замовлення.
function getFlightNumber(order) {
  return String(order?.flightNumber || order?.contractData?.flightNumber || '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Дістає календарну дату з рядка або Date-сумісного значення.
function getDatePart(value) {
  const text = String(value || '').trim();
  const directDate = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (directDate) {
    return directDate[1];
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

// Повертає дату рейсу з часу поїздки.
function getOrderFlightDate(order) {
  return (
    getDatePart(order?.trip?.time) ||
    getDatePart(order?.contractData?.trip?.time)
  );
}

// Повертає повне значення часу поїздки.
function getOrderTripTime(order) {
  return order?.trip?.time || order?.contractData?.trip?.time || '';
}

// Перевіряє, чи вказаний явний час, а не лише дата.
function hasExplicitClockTime(value) {
  if (!value) {
    return false;
  }

  if (value instanceof Date) {
    return Boolean(
      value.getHours() ||
        value.getMinutes() ||
        value.getSeconds() ||
        value.getMilliseconds()
    );
  }

  return /(?:T|\s)\d{1,2}:\d{2}/.test(String(value).trim());
}

// Безпечно перетворює значення на Date.
function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)
    ? text.replace(' ', 'T')
    : text;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// Формує локальний ключ дати у форматі YYYY-MM-DD.
function getLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Визначає, чи час виконання замовлення вже минув.
function isOrderCompletedByTime(order, referenceDate = new Date()) {
  const tripTime = getOrderTripTime(order);

  if (!hasExplicitClockTime(tripTime)) {
    return false;
  }

  const tripDate = parseDateValue(tripTime);
  const currentDate = parseDateValue(referenceDate);

  if (!tripDate || !currentDate) {
    return false;
  }

  if (getLocalDateKey(tripDate) !== getLocalDateKey(currentDate)) {
    return false;
  }

  return tripDate.getTime() < currentDate.getTime();
}

// Формує ключ сьогоднішньої або сусідньої локальної дати.
function getRelativeDateKey(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return getLocalDateKey(date);
}

// Дозволяє tracking лише для рейсів сьогодні або завтра.
function isFlightDateInRefreshWindow(flightDate) {
  const dateKey = getDatePart(flightDate);

  if (!dateKey) {
    return false;
  }

  return dateKey === getRelativeDateKey(0) || dateKey === getRelativeDateKey(1);
}

// Дістає дату з часових полів статусу рейсу.
function getFlightStatusDate(flightStatus) {
  return (
    getDatePart(flightStatus?.scheduledArrival) ||
    getDatePart(flightStatus?.estimatedArrival) ||
    getDatePart(flightStatus?.actualArrival)
  );
}

// Перевіряє, що статус належить потрібній даті рейсу.
function isFlightStatusForDate(flightStatus, flightDate) {
  const expectedDate = getDatePart(flightDate);

  if (!expectedDate) {
    return true;
  }

  return getFlightStatusDate(flightStatus) === expectedDate;
}

// Нормалізує текстове значення статусу.
function getStatusValue(flightStatus) {
  return String(flightStatus?.status || '').trim().toLowerCase();
}

// Повертає затримку в додатних хвилинах.
function getDelayMinutes(flightStatus) {
  const parsed = Number.parseInt(String(flightStatus?.delayMinutes ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// Перевіряє, чи статус містить корисні фактичні часові дані.
function hasUsefulTiming(flightStatus) {
  return Boolean(flightStatus?.actualArrival || flightStatus?.estimatedArrival || getDelayMinutes(flightStatus) > 0);
}

// Узгоджує статус delayed із фактичною затримкою.
function normalizeFlightStatusValue(flightStatus) {
  if (!isPlainObject(flightStatus)) {
    return null;
  }

  if (getDelayMinutes(flightStatus) > 0 && getStatusValue(flightStatus) !== 'delayed') {
    return {
      ...flightStatus,
      status: 'delayed',
    };
  }

  return flightStatus;
}

// Виявляє scheduled/unknown без ETA або затримки.
function isWeakScheduledStatus(flightStatus) {
  const status = getStatusValue(flightStatus);
  return (status === 'scheduled' || status === 'unknown') && !hasUsefulTiming(flightStatus);
}

// Перевіряє, чи статус містить важливу оперативну інформацію.
function isInformativeStatus(flightStatus) {
  const status = getStatusValue(flightStatus);
  return (
    status === 'landed' ||
    status === 'delayed' ||
    status === 'in_air' ||
    status === 'cancelled' ||
    hasUsefulTiming(flightStatus)
  );
}

// Об’єднує нову відповідь зі старою без втрати кориснішого статусу.
function mergeFlightStatus(existingFlightStatus, nextFlightStatus, flightDate) {
  const normalizedNextFlightStatus = normalizeFlightStatusValue(nextFlightStatus);

  if (!normalizedNextFlightStatus) {
    return null;
  }

  const normalizedExistingFlightStatus = normalizeFlightStatusValue(existingFlightStatus);
  const existingMatchesDate = isFlightStatusForDate(normalizedExistingFlightStatus, flightDate);

  if (!isFlightStatusForDate(normalizedNextFlightStatus, flightDate)) {
    return existingMatchesDate ? normalizedExistingFlightStatus : null;
  }

  if (
    isWeakScheduledStatus(normalizedNextFlightStatus) &&
    existingMatchesDate &&
    isInformativeStatus(normalizedExistingFlightStatus)
  ) {
    return {
      ...normalizedExistingFlightStatus,
      updatedAt: normalizedNextFlightStatus.updatedAt || normalizedExistingFlightStatus.updatedAt,
    };
  }

  return normalizedNextFlightStatus;
}

// Нормалізує статус, уже збережений у metadata замовлення.
function normalizeCachedFlightStatus(metadata) {
  if (!isPlainObject(metadata?.flightStatus)) {
    return null;
  }

  const normalizedFlightStatus = normalizeFlightStatusValue(metadata.flightStatus);

  if (normalizedFlightStatus !== metadata.flightStatus) {
    return {
      ...(isPlainObject(metadata) ? metadata : {}),
      flightStatus: normalizedFlightStatus,
    };
  }

  return null;
}

// Перевіряє актуальність статусу всередині конкретного замовлення.
function isFlightStatusFresh(metadata, flightDate) {
  if (!isPlainObject(metadata?.flightStatus)) {
    return false;
  }

  if (!isFlightStatusForDate(metadata.flightStatus, flightDate)) {
    return false;
  }

  const updatedAt = new Date(metadata.flightStatus.updatedAt || '');

  if (Number.isNaN(updatedAt.getTime())) {
    return false;
  }

  return Date.now() - updatedAt.getTime() < getCacheTtlMs();
}

// Перевіряє, чи група замовлень уже має свіжий статус.
function flightGroupHasFreshStatus(group) {
  return group.some(order =>
    isFlightStatusFresh(order.metadata, getOrderFlightDate(order))
  );
}

// Видаляє застарілий flight status із metadata.
function removeFlightStatusFromMetadata(metadata) {
  const normalizedMetadata = isPlainObject(metadata) ? { ...metadata } : {};
  delete normalizedMetadata.flightStatus;
  return normalizedMetadata;
}

// Зберігає форму select поточного об’єкта після Prisma update.
function buildOrderSelect(order) {
  return Object.fromEntries(Object.keys(order).map(key => [key, true]));
}

// Оновлює лише metadata замовлення та повертає той самий набір полів.
function updateOrderMetadata(client, order, metadata) {
  return client.order.update({
    where: {
      id: order.id,
    },
    data: {
      metadata,
    },
    select: buildOrderSelect(order),
  });
}

// Порівнює два нормалізовані статуси рейсу.
function haveSameFlightStatus(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

// Записує глобальний статус у metadata конкретного замовлення.
async function applyFlightStatusToOrder(client, order, flightStatus, flightDate) {
  const mergedFlightStatus = mergeFlightStatus(
    order.metadata?.flightStatus,
    flightStatus,
    flightDate
  );

  if (!mergedFlightStatus || haveSameFlightStatus(order.metadata?.flightStatus, mergedFlightStatus)) {
    return order;
  }

  return updateOrderMetadata(client, order, {
    ...(isPlainObject(order.metadata) ? order.metadata : {}),
    flightStatus: mergedFlightStatus,
  });
}

// Оновлює один рейс через глобальний кеш і синхронізує замовлення.
async function refreshOrderFlightStatusWithOptions(
  client,
  order,
  {
    allowRefresh = true,
    fetchFlightStatus = fetchAviationstackFlightStatus,
    now,
  } = {}
) {
  const flightNumber = getFlightNumber(order);

  if (!flightNumber) {
    return order;
  }

  if (isOrderCompletedByTime(order)) {
    return order;
  }

  const flightDate = getOrderFlightDate(order);

  if (!isFlightDateInRefreshWindow(flightDate)) {
    return order;
  }

  let currentOrder = order;

  if (
    isPlainObject(currentOrder.metadata?.flightStatus) &&
    !isFlightStatusForDate(currentOrder.metadata.flightStatus, flightDate)
  ) {
    currentOrder = await updateOrderMetadata(
      client,
      currentOrder,
      removeFlightStatusFromMetadata(currentOrder.metadata)
    );
  }

  const normalizedMetadata = normalizeCachedFlightStatus(currentOrder.metadata);

  if (normalizedMetadata) {
    currentOrder = await updateOrderMetadata(client, currentOrder, normalizedMetadata);
  }

  try {
    const flightStatus = await getCachedOrRefreshFlightStatus(client, {
      flightNumber,
      flightDate,
      seedStatus: currentOrder.metadata?.flightStatus,
      fetchFlightStatus,
      // Не замінюємо delayed/in_air слабкою відповіддю scheduled без ETA.
      mergeStatus: (cachedStatus, nextStatus) =>
        mergeFlightStatus(cachedStatus, nextStatus, flightDate),
      allowRefresh,
      ...(now ? { now } : {}),
    });

    if (!flightStatus) {
      return currentOrder;
    }

    return applyFlightStatusToOrder(client, currentOrder, flightStatus, flightDate);
  } catch (error) {
    console.warn(
      `Failed to refresh flight status for order ${order?.id || ''}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return currentOrder;
  }
}

// Групує список за рейсом і оновлює кожен у межах заданого бюджету.
export async function refreshFlightStatusesForOrders(
  client,
  orders,
  {
    enabled = false,
    limit,
    fetchFlightStatus,
    now,
  } = {}
) {
  if (!enabled || !Array.isArray(orders) || !orders.length) {
    return orders;
  }

  const maxRefresh = Number.isFinite(limit) && limit > 0 ? limit : getMaxRefreshPerRequest();
  const refreshGroupsByKey = new Map();

  for (const order of orders) {
    const flightDate = getOrderFlightDate(order);

    if (
      !getFlightNumber(order) ||
      isOrderCompletedByTime(order) ||
      !isFlightDateInRefreshWindow(flightDate)
    ) {
      continue;
    }

    const cacheKey = getFlightCacheKey(getFlightNumber(order), flightDate);
    const group = refreshGroupsByKey.get(cacheKey) || [];
    group.push(order);
    refreshGroupsByKey.set(cacheKey, group);
  }

  if (!refreshGroupsByKey.size) {
    return orders;
  }

  const refreshedById = new Map();
  // Один рейс має один кеш; спочатку обробляються групи без свіжих даних.
  const refreshGroups = Array.from(refreshGroupsByKey.values())
    .sort((left, right) =>
      Number(flightGroupHasFreshStatus(left)) - Number(flightGroupHasFreshStatus(right))
    )
    .slice(0, maxRefresh);

  await Promise.all(refreshGroups.map(async group => {
    const representative =
      group.find(order => isFlightStatusFresh(order.metadata, getOrderFlightDate(order))) ||
      group.find(order => isPlainObject(order.metadata?.flightStatus)) ||
      group[0];
    const refreshedRepresentative = await refreshOrderFlightStatusWithOptions(
      client,
      representative,
      {
        ...(fetchFlightStatus ? { fetchFlightStatus } : {}),
        ...(now ? { now } : {}),
      }
    );
    const flightDate = getOrderFlightDate(representative);
    const groupFlightStatus = refreshedRepresentative.metadata?.flightStatus;
    refreshedById.set(refreshedRepresentative.id, refreshedRepresentative);

    if (!isPlainObject(groupFlightStatus)) {
      return;
    }

    await Promise.all(group
      .filter(order => order.id !== representative.id)
      .map(async order => {
        const refreshedOrder = await applyFlightStatusToOrder(
          client,
          order,
          groupFlightStatus,
          flightDate
        );
        refreshedById.set(order.id, refreshedOrder);
      }));
  }));

  return orders.map(order => refreshedById.get(order.id) || order);
}

// Оновлює статус для сторінки одного замовлення.
export async function refreshFlightStatusForOrder(
  client,
  order,
  {
    enabled = false,
    fetchFlightStatus,
    now,
  } = {}
) {
  if (!enabled || !order) {
    return order;
  }

  return refreshOrderFlightStatusWithOptions(client, order, {
    ...(fetchFlightStatus ? { fetchFlightStatus } : {}),
    ...(now ? { now } : {}),
  });
}
