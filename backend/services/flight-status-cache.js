const MIN_REFRESH_INTERVAL_MINUTES = 15;
const DEFAULT_REFRESH_INTERVAL_MINUTES = 15;
const DEFAULT_FUTURE_REFRESH_INTERVAL_MINUTES = 60;
const REFRESH_LOCK_MS = 30 * 1000;

// Перевіряє, що значення є звичайним об’єктом.
function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

// Читає додатну кількість хвилин або повертає резервне значення.
function readPositiveMinutes(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Повертає базовий TTL, який не може бути меншим за 15 хвилин.
function getRefreshIntervalMinutes() {
  // Це захист бюджету: env може лише збільшити мінімальний інтервал.
  return Math.max(
    MIN_REFRESH_INTERVAL_MINUTES,
    readPositiveMinutes(
      process.env.AVIATIONSTACK_CACHE_TTL_MINUTES,
      DEFAULT_REFRESH_INTERVAL_MINUTES
    )
  );
}

// Повертає довший TTL для рейсів на наступний день.
function getFutureRefreshIntervalMinutes() {
  return Math.max(
    getRefreshIntervalMinutes(),
    readPositiveMinutes(
      process.env.AVIATIONSTACK_FUTURE_CACHE_TTL_MINUTES,
      DEFAULT_FUTURE_REFRESH_INTERVAL_MINUTES
    )
  );
}

// Додає вказану кількість хвилин до дати.
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Безпечно перетворює значення на Date.
function parseDate(value) {
  const date = value instanceof Date ? value : new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
}

// Формує локальний ключ дати у форматі YYYY-MM-DD.
function getDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Визначає, чи належить рейс до майбутньої дати.
function isFutureFlightDate(flightDate, now) {
  return String(flightDate || '') > getDateKey(now);
}

// Перевіряє, чи статус рейсу вже не потребує оновлень.
function isTerminalStatus(status) {
  return status === 'landed' || status === 'cancelled';
}

// Обчислює наступний дозволений час запиту або вимикає оновлення.
function getNextRefreshAt(flightDate, status, now) {
  if (isTerminalStatus(status)) {
    return null;
  }

  const minutes = isFutureFlightDate(flightDate, now)
    ? getFutureRefreshIntervalMinutes()
    : getRefreshIntervalMinutes();
  return addMinutes(now, minutes);
}

// Повертає лише коректний об’єкт статусу з кешу.
function normalizeCachedPayload(value) {
  return isPlainObject(value) ? value : null;
}

// Відновлює часові поля кешу зі старого статусу в metadata замовлення.
function getSeedTimes(seedStatus, flightDate, now) {
  const refreshedAt = parseDate(seedStatus?.updatedAt);

  if (!refreshedAt) {
    return {
      refreshedAt: null,
      nextRefreshAt: now,
    };
  }

  return {
    refreshedAt,
    nextRefreshAt: isTerminalStatus(String(seedStatus?.status || '').toLowerCase())
      ? null
      : getNextRefreshAt(
          flightDate,
          String(seedStatus?.status || '').toLowerCase(),
          refreshedAt
        ),
  };
}

// Створює глобальний кеш рейсу або читає вже наявний запис.
async function ensureCacheRecord(client, { flightNumber, flightDate, seedStatus, now }) {
  // Початкове наповнення не запускає зайвий платний запит після деплою.
  const seedTimes = getSeedTimes(seedStatus, flightDate, now);
  const createData = {
    flightNumber,
    flightDate,
    lastAttemptAt: seedTimes.refreshedAt,
    refreshedAt: seedTimes.refreshedAt,
    nextRefreshAt: seedTimes.nextRefreshAt,
    lockUntil: null,
    lastError: '',
    ...(isPlainObject(seedStatus) ? { payload: seedStatus } : {}),
  };

  return client.flightStatusCache.upsert({
    where: {
      flightNumber_flightDate: {
        flightNumber,
        flightDate,
      },
    },
    create: createData,
    update: {},
  });
}

// Читає запис кешу за номером рейсу та датою.
async function readCacheRecord(client, flightNumber, flightDate) {
  return client.flightStatusCache.findUnique({
    where: {
      flightNumber_flightDate: {
        flightNumber,
        flightDate,
      },
    },
  });
}

// Перевіряє, чи вже настав дозволений час оновлення.
function isRefreshDue(cacheRecord, now) {
  if (!cacheRecord || cacheRecord.nextRefreshAt === null) {
    return false;
  }

  const nextRefreshAt = parseDate(cacheRecord.nextRefreshAt);
  return !nextRefreshAt || nextRefreshAt.getTime() <= now.getTime();
}

// Атомарно резервує право на один зовнішній запит.
async function claimRefresh(client, cacheRecord, now) {
  // nextRefreshAt переноситься до API-виклику, тому паралельні інстанси не дублюють запит.
  const nextRefreshAt = addMinutes(now, getRefreshIntervalMinutes());
  const lockUntil = new Date(now.getTime() + REFRESH_LOCK_MS);
  const claimed = await client.flightStatusCache.updateMany({
    where: {
      flightNumber: cacheRecord.flightNumber,
      flightDate: cacheRecord.flightDate,
      nextRefreshAt: {
        lte: now,
      },
      OR: [
        { lockUntil: null },
        {
          lockUntil: {
            lte: now,
          },
        },
      ],
    },
    data: {
      lastAttemptAt: now,
      nextRefreshAt,
      lockUntil,
      lastError: '',
    },
  });

  return claimed.count === 1;
}

// Зберігає успішно отриманий статус і наступний час оновлення.
async function finishRefresh(client, cacheRecord, flightStatus, now) {
  return client.flightStatusCache.update({
    where: {
      flightNumber_flightDate: {
        flightNumber: cacheRecord.flightNumber,
        flightDate: cacheRecord.flightDate,
      },
    },
    data: {
      payload: flightStatus,
      refreshedAt: now,
      nextRefreshAt: getNextRefreshAt(
        cacheRecord.flightDate,
        String(flightStatus.status || '').toLowerCase(),
        now
      ),
      lockUntil: null,
      lastError: '',
    },
  });
}

// Фіксує помилку, не скидаючи встановлений 15-хвилинний cooldown.
async function failRefresh(client, cacheRecord, error) {
  const message = error instanceof Error ? error.message : String(error || 'Empty API response');
  await client.flightStatusCache.update({
    where: {
      flightNumber_flightDate: {
        flightNumber: cacheRecord.flightNumber,
        flightDate: cacheRecord.flightDate,
      },
    },
    data: {
      // Помилка не дозволяє повторювати платний запит до завершення cooldown.
      lockUntil: null,
      lastError: message.slice(0, 500),
    },
  });
}

// Нормалізує номер рейсу для єдиного ключа кешу.
export function normalizeFlightCacheNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Формує унікальний ключ кешу з номера рейсу та дати.
export function getFlightCacheKey(flightNumber, flightDate) {
  return `${normalizeFlightCacheNumber(flightNumber)}:${String(flightDate || '').trim()}`;
}

// Повертає кешований статус або виконує один захищений refresh.
export async function getCachedOrRefreshFlightStatus(
  client,
  {
    flightNumber,
    flightDate,
    seedStatus = null,
    fetchFlightStatus,
    mergeStatus = (_cachedStatus, nextStatus) => nextStatus,
    allowRefresh = true,
    now: getNow = () => new Date(),
  }
) {
  const normalizedFlightNumber = normalizeFlightCacheNumber(flightNumber);
  const normalizedFlightDate = String(flightDate || '').trim();

  if (!normalizedFlightNumber || !normalizedFlightDate) {
    return normalizeCachedPayload(seedStatus);
  }

  const now = getNow();
  let cacheRecord = await ensureCacheRecord(client, {
    flightNumber: normalizedFlightNumber,
    flightDate: normalizedFlightDate,
    seedStatus,
    now,
  });

  if (!allowRefresh || !isRefreshDue(cacheRecord, now)) {
    return normalizeCachedPayload(cacheRecord.payload) || normalizeCachedPayload(seedStatus);
  }

  const claimed = await claimRefresh(client, cacheRecord, now);

  if (!claimed) {
    // Інший інстанс уже оновлює рейс, тому повертаємо попередній кеш.
    cacheRecord = await readCacheRecord(client, normalizedFlightNumber, normalizedFlightDate);
    return normalizeCachedPayload(cacheRecord?.payload) || normalizeCachedPayload(seedStatus);
  }

  try {
    const flightStatus = await fetchFlightStatus(normalizedFlightNumber, {
      flightDate: normalizedFlightDate,
    });

    if (!isPlainObject(flightStatus)) {
      await failRefresh(client, cacheRecord, new Error('Empty API response'));
      return normalizeCachedPayload(cacheRecord.payload) || normalizeCachedPayload(seedStatus);
    }

    const mergedFlightStatus = mergeStatus(
      normalizeCachedPayload(cacheRecord.payload),
      flightStatus
    );

    if (!isPlainObject(mergedFlightStatus)) {
      await failRefresh(client, cacheRecord, new Error('Invalid merged flight status'));
      return normalizeCachedPayload(cacheRecord.payload) || normalizeCachedPayload(seedStatus);
    }

    const updatedCache = await finishRefresh(client, cacheRecord, mergedFlightStatus, now);
    return normalizeCachedPayload(updatedCache.payload);
  } catch (error) {
    await failRefresh(client, cacheRecord, error);
    throw error;
  }
}

export const flightStatusCacheInternals = {
  MIN_REFRESH_INTERVAL_MINUTES,
  getRefreshIntervalMinutes,
  getFutureRefreshIntervalMinutes,
  getNextRefreshAt,
};
