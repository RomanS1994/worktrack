import { formatDateTime, getDateKey, getOrderDate, parseDateValue } from '../shared/dateUtils.js';

const EUR_RATE = 25;
const ORDER_COMPLETION_DELAY_MS = 60 * 60 * 1000;

// Дістаємо суму й валюту з текстового поля.
function parseMoneyValue(value) {
  if (value === null || value === undefined) {
    return { amount: 0, currency: 'EUR' };
  }

  const text = String(value).trim();
  const currencyMatch = text.match(/\b(EUR|CZK)\b/i);
  const amountMatch = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0]) : 0;
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'EUR';

  if (!Number.isFinite(amount)) {
    return { amount: 0, currency };
  }

  return { amount, currency };
}

// Переводимо суму між EUR і CZK.
function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (fromCurrency === 'EUR' && toCurrency === 'CZK') {
    return amount * EUR_RATE;
  }

  if (fromCurrency === 'CZK' && toCurrency === 'EUR') {
    return amount / EUR_RATE;
  }

  return amount;
}

// Форматуємо суму без зайвих нулів після коми.
function formatAmount(value, fractionDigits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(number);
}

function getOrderTripTime(order) {
  return order?.contractData?.trip?.time || order?.trip?.time || '';
}

function hasExplicitClockTime(value) {
  if (!value) {
    return false;
  }

  if (value instanceof Date) {
    return Boolean(
      value.getHours() ||
        value.getMinutes() ||
        value.getSeconds() ||
        value.getMilliseconds(),
    );
  }

  return /(?:T|\s)\d{1,2}:\d{2}/.test(String(value).trim());
}

function hasOrderTripClockTime(order) {
  return hasExplicitClockTime(getOrderTripTime(order));
}

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

  if (getDateKey(tripDate) !== getDateKey(currentDate)) {
    return false;
  }

  return tripDate.getTime() + ORDER_COMPLETION_DELAY_MS <= currentDate.getTime();
}

function getCustomerName(order) {
  return (
    order?.contractData?.customer?.name ||
    order?.customer?.name ||
    'Client not specified'
  );
}

// Показуємо чисту суму замовлення без комісії.
function getTotalPrice(order) {
  const gross = parseMoneyValue(order?.contractData?.totalPrice || order?.totalPrice);
  const commission = parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
  const netCzk = convertAmount(gross.amount, gross.currency, 'CZK') - convertAmount(commission.amount, commission.currency, 'CZK');

  if (!Number.isFinite(netCzk) || netCzk <= 0) {
    return 'No price';
  }

  const netEur = netCzk / EUR_RATE;

  return `${formatAmount(netEur)} EUR / ${formatAmount(Math.round(netCzk), 0)} CZK`;
}

function getRouteLabel(order) {
  const from =
    order?.contractData?.trip?.from?.address ||
    order?.trip?.from?.address ||
    order?.trip?.from ||
    '';
  const to =
    order?.contractData?.trip?.to?.address ||
    order?.trip?.to?.address ||
    order?.trip?.to ||
    '';

  if (!from || !to) {
    return 'Route not added';
  }

  return `${from} -> ${to}`;
}

function getHistoryBucket(order) {
  const todayKey = getDateKey(new Date());
  const tripKey = getDateKey(getOrderTripTime(order));
  const createdKey = getDateKey(order?.createdAt);
  const status = String(order?.status || '').toLowerCase();

  if (status.includes('fail')) {
    return {
      bucket: 'draft',
      label: 'Draft',
    };
  }

  const referenceKey = tripKey || createdKey;

  if (referenceKey) {
    if (referenceKey === todayKey) {
      return {
        bucket: 'today',
        label: 'Today',
      };
    }

    if (referenceKey > todayKey) {
      return {
        bucket: 'planned',
        label: 'Planned',
      };
    }

    return {
      bucket: 'completed',
      label: 'Completed',
    };
  }

  if (status === 'pdf_generated' || status === 'completed') {
    return {
      bucket: 'completed',
      label: 'Completed',
    };
  }

  return {
    bucket: 'draft',
    label: 'Draft',
  };
}

function getSortTimestamp(order, sortKey) {
  const primary = getOrderTripTime(order) || getOrderDate(order);
  const fallback = order?.createdAt || getOrderTripTime(order);
  const primaryTime = parseDateValue(primary)?.getTime() || 0;

  if (primaryTime) {
    return primaryTime;
  }

  return parseDateValue(fallback)?.getTime() || 0;
}

function getTodayActionSortGroup(order, referenceDate, bucket) {
  if (bucket !== 'today') {
    return 0;
  }

  if (isOrderCompletedByTime(order, referenceDate)) {
    return 2;
  }

  return hasOrderTripClockTime(order) ? 0 : 1;
}

function compareOrders(left, right, sortKey, options = {}) {
  const referenceDate = options.referenceDate || new Date();
  const leftBucket = getHistoryBucket(left).bucket;
  const rightBucket = getHistoryBucket(right).bucket;
  const leftGroup = getTodayActionSortGroup(left, referenceDate, leftBucket);
  const rightGroup = getTodayActionSortGroup(right, referenceDate, rightBucket);

  if (leftGroup !== rightGroup) {
    return leftGroup - rightGroup;
  }

  const effectiveSortKey = leftBucket === 'today' && rightBucket === 'today' && leftGroup === 0
    ? 'oldest'
    : sortKey;
  const leftTime = getSortTimestamp(left, sortKey);
  const rightTime = getSortTimestamp(right, sortKey);

  if (leftTime !== rightTime) {
    if (effectiveSortKey === 'newest') {
      return rightTime - leftTime;
    }

    return leftTime - rightTime;
  }

  return String(left?.orderNumber || '').localeCompare(String(right?.orderNumber || ''));
}

function getHistoryDateKey(order) {
  return getDateKey(getOrderDate(order));
}

function buildTabCounts(orders) {
  const counts = {
    today: 0,
    planned: 0,
    completed: 0,
  };

  for (const order of orders) {
    const bucket = getHistoryBucket(order).bucket;
    if (bucket === 'today') {
      counts.today += 1;
    }
    if (bucket === 'planned') {
      counts.planned += 1;
    }
    if (bucket === 'completed') {
      counts.completed += 1;
    }
  }

  return counts;
}

export {
  buildTabCounts,
  compareOrders,
  formatDateTime,
  getCustomerName,
  getHistoryBucket,
  getHistoryDateKey,
  getOrderTripTime,
  getRouteLabel,
  getTotalPrice,
  isOrderCompletedByTime,
};
