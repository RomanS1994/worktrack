import { parseDateValue } from '../shared/dateUtils.js';

const EUR_RATE = 25;

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

function toEurAmount(value, currency) {
  return convertAmount(value, currency, 'EUR');
}

function parseNumber(value) {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : 0;

  return Number.isFinite(number) ? number : 0;
}

function normalizePaymentMethod(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const text = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const hasCash = /\b(cash|hotove|hotovost)\b|готів|готiв/.test(text);
  const hasCard = /\b(card|karta|kartou)\b|карт/.test(text);
  const hasInvoice = /\b(invoice|faktura)\b|platform|платформ|рахунок|рахун/.test(text);

  if (hasInvoice) {
    return 'invoice';
  }

  if (hasCash && !hasCard) {
    return 'cash';
  }

  if (hasCard && !hasCash) {
    return 'card';
  }

  if (text === 'cash' || text === 'card' || text === 'invoice') {
    return text;
  }

  return '';
}

function getOrderMonthDate(order) {
  return parseDateValue(order?.trip?.time || order?.contractData?.trip?.time || order?.createdAt);
}

function getOrderPaymentMethod(order) {
  return normalizePaymentMethod(
    order?.trip?.paymentMethod ||
      order?.trip?.paymentType ||
      order?.trip?.payment ||
      order?.paymentMethod ||
      order?.paymentType ||
      order?.contractData?.trip?.paymentMethod ||
      order?.contractData?.trip?.paymentType ||
      order?.contractData?.trip?.payment ||
      order?.contractData?.paymentMethod ||
      order?.contractData?.paymentType ||
      order?.contractData?.payment ||
      order?.metadata?.paymentMethod ||
      order?.metadata?.paymentType ||
      order?.metadata?.payment ||
      '',
  );
}

function getPaymentBucket(order) {
  const method = getOrderPaymentMethod(order);

  if (method === 'cash') {
    return 'cash';
  }

  if (method === 'card') {
    return 'card';
  }

  if (method === 'invoice') {
    return 'invoice';
  }

  return 'unknown';
}

function getOrderAmounts(order) {
  const gross = parseMoneyValue(order?.totalPrice || order?.contractData?.totalPrice);
  const commission = parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
  const grossEur = toEurAmount(gross.amount, gross.currency);
  const commissionEur = toEurAmount(commission.amount, commission.currency);

  return {
    commissionEur,
    grossEur,
    netEur: Math.max(0, grossEur - commissionEur),
  };
}

function getOrderDistanceKm(order) {
  return parseNumber(
    order?.metadata?.distanceKm ||
      order?.metadata?.distance ||
      order?.contractData?.trip?.distanceKm ||
      order?.contractData?.trip?.distance ||
      order?.trip?.distanceKm ||
      order?.trip?.distance,
  );
}

export function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

export function parseMonthKey(value, fallback = new Date()) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = new Date(year, month, 1);

  if (Number.isNaN(date.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }

  return date;
}

export function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  return {
    end,
    start,
  };
}

function formatMonthBoundary(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}T00:00`;
}

export function getMonthOrderQuery(date) {
  const { start, end } = getMonthRange(date);

  return {
    dateField: 'trip',
    from: formatMonthBoundary(start),
    limit: 1000,
    to: formatMonthBoundary(end),
  };
}

export function formatEuro(value) {
  const amount = Math.round(Number(value) || 0);

  return `€${amount.toLocaleString('en-GB').replace(/,/g, ' ')}`;
}

export function buildTaxMonthData(orders = [], date = new Date()) {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const dayTotals = new Map();
  const monthOrders = [];
  const paymentTotals = {
    card: 0,
    cash: 0,
    invoice: 0,
    unknown: 0,
  };
  let totalIncome = 0;
  let totalCommission = 0;
  let totalMileage = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    dayTotals.set(day, {
      amount: 0,
      day,
      orders: 0,
      trips: 0,
    });
  }

  for (const order of orders) {
    const dateValue = getOrderMonthDate(order);

    if (!dateValue || dateValue.getFullYear() !== targetYear || dateValue.getMonth() !== targetMonth) {
      continue;
    }

    const day = dateValue.getDate();
    const bucket = dayTotals.get(day);

    if (!bucket) {
      continue;
    }

    monthOrders.push(order);

    const amounts = getOrderAmounts(order);
    const paymentBucket = getPaymentBucket(order);
    const mileage = getOrderDistanceKm(order);

    bucket.amount += amounts.netEur;
    bucket.orders += 1;
    bucket.trips += 1;
    totalIncome += amounts.netEur;
    totalCommission += amounts.commissionEur;
    totalMileage += mileage;
    paymentTotals[paymentBucket] += amounts.grossEur;
  }

  const days = Array.from(dayTotals.values()).map(day => ({
    ...day,
    amountLabel: formatEuro(day.amount),
    dots: day.trips > 2 ? 2 : day.trips > 1 ? 1 : 0,
    tone: day.amount > 0 ? 'green' : 'muted',
  }));
  const activeDays = days.filter(day => day.trips > 0).length;
  const bestDay = days.reduce(
    (best, day) => (day.amount > best.amount ? day : best),
    { amount: 0, day: 0 },
  );
  const averageOrder = monthOrders.length ? totalIncome / monthOrders.length : 0;

  return {
    activeDays,
    averageOrder,
    bestDay,
    days,
    mileageKm: totalMileage,
    monthKey: getMonthKey(date),
    orders: monthOrders,
    paymentTotals,
    totalCommission,
    totalIncome,
    totalOrders: monthOrders.length,
  };
}

export function buildTaxMetricCards(monthData) {
  return [
    {
      id: 'earnings',
      tone: 'green',
      value: formatEuro(monthData.totalIncome),
    },
    {
      id: 'orders',
      tone: 'blue',
      value: String(monthData.totalOrders),
    },
  ];
}

export function getSelectedDayDetail(monthData, selectedDay) {
  return monthData.days.find(day => day.day === selectedDay) || null;
}

export function getTaxDayOrders(monthData, selectedDay) {
  const targetDay = Number(selectedDay);

  if (!targetDay) {
    return [];
  }

  return monthData.orders
    .filter(order => {
      const orderDate = getOrderMonthDate(order);

      return orderDate?.getDate() === targetDay;
    })
    .sort((left, right) => {
      const leftDate = getOrderMonthDate(left);
      const rightDate = getOrderMonthDate(right);

      return (leftDate?.getTime() || 0) - (rightDate?.getTime() || 0);
    });
}

export function getTaxOrderDisplayData(order) {
  const amounts = getOrderAmounts(order);
  const paymentBucket = getPaymentBucket(order);

  return {
    amountLabel: formatEuro(amounts.netEur),
    customerName: order?.customer?.name || order?.contractData?.customer?.name || '',
    from: order?.trip?.from || order?.contractData?.trip?.from?.address || '',
    orderDate: getOrderMonthDate(order),
    orderNumber: order?.orderNumber || order?.id || '',
    paymentMethod: getOrderPaymentMethod(order),
    paymentBucket,
    to: order?.trip?.to || order?.contractData?.trip?.to?.address || '',
  };
}
