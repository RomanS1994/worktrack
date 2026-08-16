import { getOrderDate, parseDateValue } from './dateUtils.js';

const EUR_RATE = 25;

function getLocale(language) {
  if (language === 'uk') return 'uk-UA';
  if (language === 'cs') return 'cs-CZ';
  if (language === 'en') return 'en-GB';
  return 'en-GB';
}

function capitalizeWords(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function humanizePlanText(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '-';
  }

  const normalized = text
    .replace(/^plan[-_ ]?/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return capitalizeWords(normalized || text);
}

export function getPlanVariant(user) {
  const plan = user?.subscription?.plan || user?.plan || {};
  const planName = String(plan?.id || plan?.slug || plan?.name || user?.subscription?.planId || user?.planId || '').toLowerCase();
  const limit = Number(plan?.monthlyGenerationLimit || user?.subscription?.monthlyGenerationLimit || user?.monthlyGenerationLimit || 0);

  if (planName.includes('free') || planName.includes('trial') || limit <= 100) {
    return 'free';
  }

  if (planName.includes('silver') || planName.includes('starter') || limit <= 300) {
    return 'silver';
  }

  if (planName.includes('gold') || planName.includes('growth') || limit <= 500) {
    return 'gold';
  }

  if (planName.includes('platinum') || planName.includes('scale') || limit > 500) {
    return 'platinum';
  }

  return 'silver';
}

function parseMoneyValue(value) {
  if (value === null || value === undefined) {
    return { amount: 0, currency: 'CZK' };
  }

  const text = String(value).trim();
  const currencyMatch = text.match(/\b(EUR|CZK)\b/i);
  const amountMatch = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0]) : 0;
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'CZK';

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

function formatDate(date, language) {
  return new Intl.DateTimeFormat(getLocale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatCzkAmount(value) {
  return `${Math.round(value).toLocaleString('cs-CZ')} CZK`;
}

export function getPlanTypeLabel(user) {
  const plan = user?.subscription?.plan || user?.plan || {};
  const candidate =
    plan?.name ||
    user?.subscription?.planName ||
    user?.planName ||
    plan?.slug ||
    plan?.id ||
    user?.subscription?.planId ||
    user?.planId ||
    '';

  const text = String(candidate || '').trim();

  if (!text) {
    return '-';
  }

  return humanizePlanText(text);
}

export function getSubscriptionWindow(subscription, language = 'en') {
  const start = parseDateValue(subscription?.currentPeriodStart);
  const end = parseDateValue(subscription?.currentPeriodEnd);

  if (!start || !end) {
    return '-';
  }

  return `${formatDate(start, language)} - ${formatDate(end, language)}`;
}

export function getSubscriptionWindowParts(subscription, language = 'en') {
  const start = parseDateValue(subscription?.currentPeriodStart);
  const end = parseDateValue(subscription?.currentPeriodEnd);

  if (!start || !end) {
    return {
      start: '-',
      end: '-',
    };
  }

  return {
    start: formatDate(start, language),
    end: formatDate(end, language),
  };
}

export function getSubscriptionEndDate(subscription, language = 'en') {
  const end = parseDateValue(subscription?.currentPeriodEnd);

  if (!end) {
    return '-';
  }

  return formatDate(end, language);
}

export function getCycleOrders(orders = [], subscription) {
  const start = parseDateValue(subscription?.currentPeriodStart);
  const end = parseDateValue(subscription?.currentPeriodEnd);

  if (!start || !end) {
    return orders;
  }

  return orders.filter(order => {
    const date = parseDateValue(getOrderDate(order));

    if (!date) {
      return false;
    }

    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  });
}

export function getSalaryTotal(orders = [], subscription) {
  const cycleOrders = getCycleOrders(orders, subscription);

  const total = cycleOrders.reduce((sum, order) => {
    const gross = parseMoneyValue(order?.totalPrice || order?.contractData?.totalPrice);
    const commission = parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
    const netGross = convertAmount(gross.amount, gross.currency, 'CZK');
    const netCommission = convertAmount(commission.amount, commission.currency, 'CZK');

    return sum + netGross - netCommission;
  }, 0);

  return formatCzkAmount(total);
}

export function getWeeklySalaryTotal(orders = []) {
  const now = new Date();
  const weekStart = new Date(now);
  const currentDay = weekStart.getDay();
  const mondayOffset = (currentDay + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const total = orders.reduce((sum, order) => {
    const orderDate = parseDateValue(getOrderDate(order));

    if (
      !orderDate ||
      orderDate.getTime() < weekStart.getTime() ||
      orderDate.getTime() > weekEnd.getTime()
    ) {
      return sum;
    }

    const gross = parseMoneyValue(order?.totalPrice || order?.contractData?.totalPrice);
    const commission = parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
    const netGross = convertAmount(gross.amount, gross.currency, 'CZK');
    const netCommission = convertAmount(commission.amount, commission.currency, 'CZK');

    return sum + netGross - netCommission;
  }, 0);

  return formatCzkAmount(total);
}
