import { Prisma } from '@prisma/client';

import { renderPdfFromHtml } from '../pdf/renderer.js';
import { normalizeUserProfile } from './profiles.js';
import { normalizeText } from '../validation/common.js';

const DRIVER_NAME_FALLBACK = 'Driver';
const EUR_RATE = 25;

const LOCALES = {
  cs: 'cs-CZ',
  en: 'en-GB',
  uk: 'uk-UA',
};

const REPORT_LABELS = {
  cs: {
    activeDays: 'Aktivních dnů',
    averageOrder: 'Průměrná zakázka',
    accountantData: 'PODKLADY PRO ÚČETNÍ',
    accountantDataSubtitle: 'data pro účetnictví',
    accountantNote: 'Tento dokument slouží jako podklad pro účetní a daňové účely.',
    address: 'Adresa',
    bestDay: 'Nejlepší den',
    card: 'Karta',
    cash: 'Hotovost',
    commission: 'Komise',
    commissions: 'Komise služeb',
    date: 'Datum',
    dateGenerated: 'Datum vytvoření',
    dic: 'DIČ',
    direct: 'Direct',
    documentId: 'Doklad / ID',
    driver: 'Řidič',
    driverReport: 'Měsíční přehled',
    earningsByDay: 'Příjmy po dnech',
    excelSubtitle: 'Detailní přehled objednávek',
    generatedFile: 'Soubor vygenerován',
    from: 'Odkud',
    grossIncome: 'Celkové příjmy',
    id: 'ID',
    invoice: 'Faktura',
    income: 'Příjem',
    incomeAfterCommissions: 'Příjmy po odečtení komisí',
    incomeOverview: 'Přehled příjmů',
    incomeSummary: 'Souhrn příjmů',
    expense: 'Výdaj',
    expenseSummary: 'Souhrn výdajů / komisí',
    ico: 'IČO',
    mileage: 'Nájezd',
    monthlySummary: 'Souhrn za měsíc',
    name: 'Jméno',
    netIncome: 'Čistý příjem',
    orders: 'Objednávky',
    page: 'Stránka',
    pageOf: 'z',
    paymentType: 'Typ platby',
    paymentsByType: 'Podle typu platby',
    period: 'Období',
    preparedAt: 'Datum vyhotovení',
    provider: 'Poskytovatel',
    proprietor: 'Podnikatel',
    reportFootnote: 'Údaje jsou uvedeny v EUR. Přehled není daňovým dokladem.',
    time: 'Čas',
    to: 'Kam',
    topDays: 'Top dny podle příjmů',
    total: 'Celkem',
    totalIncome: 'Celkové příjmy',
    totalJobs: 'Celkový počet zakázek',
    totalIncomeRow: 'CELKEM PŘÍJMY',
    unknownPayment: 'Neuvedeno',
  },
  en: {
    activeDays: 'Active days',
    accountantData: 'ACCOUNTANT DATA',
    accountantDataSubtitle: 'accounting data',
    accountantNote: 'This document is intended as supporting data for accounting and tax purposes.',
    address: 'Address',
    averageOrder: 'Average order',
    bestDay: 'Best day',
    card: 'Card',
    cash: 'Cash',
    commission: 'Commission',
    commissions: 'Service commissions',
    date: 'Date',
    dateGenerated: 'Generated at',
    dic: 'VAT ID',
    direct: 'Direct',
    documentId: 'Document / ID',
    driver: 'Driver',
    driverReport: 'Monthly report',
    earningsByDay: 'Income by day',
    excelSubtitle: 'Detailed order report',
    generatedFile: 'File generated',
    from: 'From',
    grossIncome: 'Total income',
    id: 'ID',
    invoice: 'Invoice',
    ico: 'Company ID',
    income: 'Income',
    incomeAfterCommissions: 'Income after commissions',
    incomeOverview: 'Income overview',
    incomeSummary: 'Income summary',
    expense: 'Expense',
    expenseSummary: 'Expense / commission summary',
    mileage: 'Mileage',
    monthlySummary: 'Monthly summary',
    name: 'Name',
    netIncome: 'Net income',
    orders: 'Orders',
    page: 'Page',
    pageOf: 'of',
    paymentType: 'Payment type',
    paymentsByType: 'By payment type',
    period: 'Period',
    preparedAt: 'Prepared at',
    provider: 'Provider',
    proprietor: 'Entrepreneur',
    reportFootnote: 'Amounts are stated in EUR. This report is not a tax document.',
    time: 'Time',
    to: 'To',
    topDays: 'Top days by income',
    total: 'Total',
    totalIncome: 'Total income',
    totalJobs: 'Total order count',
    totalIncomeRow: 'TOTAL INCOME',
    unknownPayment: 'Not specified',
  },
  uk: {
    activeDays: 'Активних днів',
    accountantData: 'ДАНІ ДЛЯ БУХГАЛТЕРА',
    accountantDataSubtitle: 'дані для обліку',
    accountantNote: 'Цей документ служить як підстава для бухгалтерського та податкового обліку.',
    address: 'Адреса',
    averageOrder: 'Середній чек',
    bestDay: 'Найкращий день',
    card: 'Картка',
    cash: 'Готівка',
    commission: 'Комісія',
    commissions: 'Комісії сервісів',
    date: 'Дата',
    dateGenerated: 'Дата формування',
    dic: 'DIČ',
    direct: 'Direct',
    documentId: 'Документ / ID',
    driver: 'Водій',
    driverReport: 'Місячний звіт',
    earningsByDay: 'Доходи по днях',
    excelSubtitle: 'Детальний звіт по замовленнях',
    generatedFile: 'Файл згенеровано',
    from: 'Звідки',
    grossIncome: 'Загальний дохід',
    id: 'ID',
    invoice: 'Фактура',
    ico: 'IČO',
    income: 'Дохід',
    incomeAfterCommissions: 'Дохід після комісій',
    incomeOverview: 'Огляд доходів',
    incomeSummary: 'Підсумок доходів',
    expense: 'Витрата',
    expenseSummary: 'Підсумок витрат / комісій',
    mileage: 'Пробіг',
    monthlySummary: 'Підсумок за місяць',
    name: "Ім'я",
    netIncome: 'Чистий дохід',
    orders: 'Замовлень',
    page: 'Сторінка',
    pageOf: 'з',
    paymentType: 'Тип оплати',
    paymentsByType: 'За типом оплати',
    period: 'Період',
    preparedAt: 'Дата формування',
    provider: 'Постачальник',
    proprietor: 'Підприємець',
    reportFootnote: 'Дані вказані в EUR. Звіт не є податковим документом.',
    time: 'Час',
    to: 'Куди',
    topDays: 'Топ днів за доходом',
    total: 'Разом',
    totalIncome: 'Загальний дохід',
    totalJobs: 'Загальна кількість замовлень',
    totalIncomeRow: 'РАЗОМ ДОХОДИ',
    unknownPayment: 'Не вказано',
  },
};

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeLanguage(value) {
  const language = String(value || '').slice(0, 2).toLowerCase();

  return REPORT_LABELS[language] ? language : 'uk';
}

function getLabels(language) {
  return REPORT_LABELS[normalizeLanguage(language)];
}

function getLocale(language) {
  return LOCALES[normalizeLanguage(language)] || LOCALES.uk;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseMonthKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const date = new Date(year, monthIndex, 1);

  return Number.isNaN(date.getTime())
    ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    : date;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  return {
    end,
    endInclusive: new Date(end.getFullYear(), end.getMonth(), 0),
    start,
  };
}

function formatMonthBoundary(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T00:00`;
}

function formatDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatMonthLabel(date, language) {
  const label = new Intl.DateTimeFormat(getLocale(language), {
    month: 'long',
    year: 'numeric',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatGeneratedAt(date = new Date()) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

function formatEuro(value) {
  const amount = Number(value) || 0;

  return `€ ${amount.toLocaleString('en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 ? 2 : 0,
  })}`;
}

function formatEuroPlain(value) {
  const amount = Number(value) || 0;

  return amount.toLocaleString('en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatExcelNumber(value) {
  const amount = Number(value) || 0;

  return amount.toFixed(2);
}

function parseMoneyValue(value) {
  if (value === null || value === undefined) {
    return { amount: 0, currency: 'EUR' };
  }

  const text = String(value).trim();
  const currencyMatch = text.match(/\b(EUR|CZK)\b|€/i);
  const amountMatch = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0]) : 0;
  const currency = currencyMatch
    ? (currencyMatch[0] === '€' ? 'EUR' : currencyMatch[1].toUpperCase())
    : 'EUR';

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency,
  };
}

function toEurAmount(value, currency) {
  if (currency === 'CZK') {
    return value / EUR_RATE;
  }

  return value;
}

function parseNumber(value) {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : 0;

  return Number.isFinite(number) ? number : 0;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value).replace(' ', 'T'));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickTextValue(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeText(value);
  }

  if (value && typeof value === 'object') {
    return normalizeText(value.address || value.name || value.value || value.email || '');
  }

  return '';
}

function pickBusinessParty(value) {
  return value && typeof value === 'object' ? value : {};
}

function getOrderProviderLabel(order) {
  const provider = pickBusinessParty(order.contractData?.provider);
  const company = pickBusinessParty(order.contractData?.company);
  const name = normalizeText(provider.name || company.name);
  const address = normalizeText(provider.address || company.address);

  return [name, address].filter(Boolean).join(' · ') || '-';
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

function getOrderPaymentMethod(order) {
  return normalizePaymentMethod(
    order.trip?.paymentMethod ||
      order.trip?.paymentType ||
      order.trip?.payment ||
      order.paymentMethod ||
      order.paymentType ||
      order.contractData?.trip?.paymentMethod ||
      order.contractData?.trip?.paymentType ||
      order.contractData?.trip?.payment ||
      order.contractData?.paymentMethod ||
      order.contractData?.paymentType ||
      order.contractData?.payment ||
      order.metadata?.paymentMethod ||
      order.metadata?.paymentType ||
      order.metadata?.payment ||
      '',
  );
}

function getPaymentBucket(paymentMethod) {
  if (paymentMethod === 'cash') return 'cash';
  if (paymentMethod === 'card') return 'card';
  if (paymentMethod === 'invoice') return 'invoice';

  return 'unknown';
}

function getPaymentLabel(paymentMethod, labels) {
  if (paymentMethod === 'cash') return labels.cash;
  if (paymentMethod === 'card') return labels.card;
  if (paymentMethod === 'invoice') return labels.invoice;

  return labels.unknownPayment;
}

function getOrderDate(order) {
  return parseDateValue(order.trip?.time || order.contractData?.trip?.time || order.createdAt);
}

function getOrderAmounts(order) {
  const gross = parseMoneyValue(order.totalPrice || order.contractData?.totalPrice);
  const commission = parseMoneyValue(order.metadata?.commission || order.contractData?.commission);
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
    order.metadata?.distanceKm ||
      order.metadata?.distance ||
      order.contractData?.trip?.distanceKm ||
      order.contractData?.trip?.distance ||
      order.trip?.distanceKm ||
      order.trip?.distance,
  );
}

function buildProfile(user = {}) {
  const normalized = normalizeUserProfile(user.profile, user.name);
  const rawProfile = user.profile && typeof user.profile === 'object' ? user.profile : {};
  const rawDriver = rawProfile.driver && typeof rawProfile.driver === 'object' ? rawProfile.driver : {};
  const rawProvider =
    rawProfile.provider && typeof rawProfile.provider === 'object' ? rawProfile.provider : {};

  return {
    address: normalized.driver.address || normalized.provider.address || '',
    dic:
      normalized.driver.dic ||
      normalized.provider.dic ||
      normalizeText(rawDriver.dicVat || rawProvider.dicVat),
    driverName: normalized.driver.name || user.name || user.email || DRIVER_NAME_FALLBACK,
    ico: normalized.driver.ico || normalized.provider.ico || '',
  };
}

function buildOrderRows(orders, labels) {
  return orders
    .map((order) => {
      const date = getOrderDate(order);
      const paymentMethod = getOrderPaymentMethod(order);
      const paymentBucket = getPaymentBucket(paymentMethod);
      const amounts = getOrderAmounts(order);
      const fromAddress = pickTextValue(order.trip?.from || order.contractData?.trip?.from);
      const toAddress = pickTextValue(order.trip?.to || order.contractData?.trip?.to);

      return {
        amount: amounts.grossEur,
        commission: amounts.commissionEur,
        date,
        dateLabel: date ? formatDate(date) : '',
        fromAddress,
        id: normalizeText(order.orderNumber || order.id),
        mileageKm: getOrderDistanceKm(order),
        net: amounts.netEur,
        paymentBucket,
        paymentLabel: getPaymentLabel(paymentMethod, labels),
        providerLabel: getOrderProviderLabel(order),
        timeLabel: date ? formatTime(date) : '',
        toAddress,
      };
    })
    .sort((left, right) => (left.date?.getTime() || 0) - (right.date?.getTime() || 0));
}

function buildDaySummaries(orderRows, monthDate) {
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const daySummaries = new Map();

  for (let day = 1; day <= daysInMonth; day += 1) {
    daySummaries.set(day, {
      amount: 0,
      commission: 0,
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      day,
      orders: 0,
    });
  }

  for (const order of orderRows) {
    if (!order.date) {
      continue;
    }

    const summary = daySummaries.get(order.date.getDate());
    if (!summary) {
      continue;
    }

    summary.amount += order.amount;
    summary.commission += order.commission;
    summary.orders += 1;
  }

  return Array.from(daySummaries.values());
}

function buildPaymentTotals(orderRows) {
  return orderRows.reduce(
    (totals, order) => ({
      ...totals,
      [order.paymentBucket]: totals[order.paymentBucket] + order.amount,
    }),
    {
      card: 0,
      cash: 0,
      invoice: 0,
      unknown: 0,
    },
  );
}

function buildReportSummary(orderRows, days) {
  const grossIncome = orderRows.reduce((total, order) => total + order.amount, 0);
  const totalCommission = orderRows.reduce((total, order) => total + order.commission, 0);
  const mileageKm = orderRows.reduce((total, order) => total + order.mileageKm, 0);
  const bestDay = days.reduce(
    (best, day) => (day.amount > best.amount ? day : best),
    { amount: 0, date: null, day: 0, orders: 0 },
  );

  return {
    activeDays: days.filter(day => day.orders > 0).length,
    averageOrder: orderRows.length ? grossIncome / orderRows.length : 0,
    bestDay,
    grossIncome,
    mileageKm,
    netIncome: Math.max(0, grossIncome - totalCommission),
    totalCommission,
    totalOrders: orderRows.length,
  };
}

async function fetchTaxMonthOrders(client, { userId, monthDate }) {
  const { start, end } = getMonthRange(monthDate);
  const fromFilter = formatMonthBoundary(start);
  const toFilter = formatMonthBoundary(end);

  return client.$queryRaw`
    WITH scoped_orders AS (
      SELECT
        "id",
        "userId",
        "orderNumber",
        "status",
        "flightNumber",
        "customer",
        "trip",
        "totalPrice",
        "contractData",
        "metadata",
        "createdAt",
        "updatedAt",
        CASE
          WHEN COALESCE(NULLIF("trip"->>'time', ''), NULLIF("contractData"#>>'{trip,time}', '')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN COALESCE(NULLIF("trip"->>'time', ''), NULLIF("contractData"#>>'{trip,time}', '')) || 'T00:00'
          ELSE replace(COALESCE(NULLIF("trip"->>'time', ''), NULLIF("contractData"#>>'{trip,time}', '')), ' ', 'T')
        END AS "tripTimeForFilter"
      FROM "orders"
      WHERE "userId" = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM "order_offers"
          WHERE "order_offers"."orderId" = "orders"."id"
            AND "order_offers"."status" = 'open'
        )
    )
    SELECT
      "id",
      "userId",
      "orderNumber",
      "status",
      "flightNumber",
      "customer",
      "trip",
      "totalPrice",
      "contractData",
      "metadata",
      "createdAt",
      "updatedAt"
    FROM scoped_orders
    WHERE "tripTimeForFilter" IS NOT NULL
      ${Prisma.sql`AND "tripTimeForFilter" >= ${fromFilter}`}
      ${Prisma.sql`AND "tripTimeForFilter" < ${toFilter}`}
    ORDER BY "tripTimeForFilter" ASC, "createdAt" ASC
  `;
}

export async function buildTaxMonthReport(client, { user, month, language = 'uk' } = {}) {
  const reportLanguage = normalizeLanguage(language);
  const labels = getLabels(reportLanguage);
  const monthDate = parseMonthKey(month);
  const range = getMonthRange(monthDate);
  const orders = await fetchTaxMonthOrders(client, {
    monthDate,
    userId: user.id,
  });
  const orderRows = buildOrderRows(orders, labels).filter(order => (
    order.date &&
    order.date.getFullYear() === monthDate.getFullYear() &&
    order.date.getMonth() === monthDate.getMonth()
  ));
  const days = buildDaySummaries(orderRows, monthDate);
  const summary = buildReportSummary(orderRows, days);

  return {
    days,
    generatedAt: new Date(),
    generatedAtLabel: formatGeneratedAt(new Date()),
    labels,
    language: reportLanguage,
    monthDate,
    monthKey: getMonthKey(monthDate),
    monthLabel: formatMonthLabel(monthDate, reportLanguage),
    orderRows,
    paymentTotals: buildPaymentTotals(orderRows),
    periodLabel: `${formatDate(range.start)} - ${formatDate(range.endInclusive)}`,
    profile: buildProfile(user),
    summary,
  };
}

function renderLogo(report) {
  return `
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <strong>${escapeXml(report.profile.driverName)}</strong>
    </div>
  `;
}

function renderMetricCard(label, value, tone = '') {
  return `
    <section class="metric ${tone ? `metric--${tone}` : ''}">
      <span>${escapeXml(label)}</span>
      <strong>${escapeXml(value)}</strong>
    </section>
  `;
}

function renderChart(report) {
  const maxAmount = Math.max(...report.days.map(day => day.amount), 1);

  return `
    <section class="panel chart-panel">
      <h2>${escapeXml(report.labels.earningsByDay)}</h2>
      <div class="bar-chart">
        ${report.days.map((day) => {
          const height = day.amount ? Math.max(8, Math.round((day.amount / maxAmount) * 100)) : 2;

          return `
            <div class="bar-column">
              <span class="bar" style="height:${height}%"></span>
              <small>${day.day}</small>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderTopDays(report) {
  const topDays = report.days
    .filter(day => day.orders > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 4);

  return `
    <section class="panel compact-panel">
      <h2>${escapeXml(report.labels.topDays)}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeXml(report.labels.date)}</th>
            <th>${escapeXml(report.labels.orders)}</th>
            <th>${escapeXml(report.labels.income)}</th>
          </tr>
        </thead>
        <tbody>
          ${topDays.map(day => `
            <tr>
              <td>${escapeXml(formatDate(day.date))}</td>
              <td>${day.orders}</td>
              <td>${escapeXml(formatEuro(day.amount))}</td>
            </tr>
          `).join('') || '<tr><td colspan="3">-</td></tr>'}
        </tbody>
      </table>
    </section>
  `;
}

function renderPaymentSummary(report) {
  const total = Math.max(report.summary.grossIncome, 1);
  const cash = Math.round((report.paymentTotals.cash / total) * 100);
  const card = Math.round((report.paymentTotals.card / total) * 100);
  const invoice = Math.round((report.paymentTotals.invoice / total) * 100);
  const invoiceEnd = cash + card + invoice;

  return `
    <section class="panel compact-panel payment-panel">
      <h2>${escapeXml(report.labels.paymentsByType)}</h2>
      <div class="donut" style="background: conic-gradient(#16a34a 0 ${cash}%, #2563eb ${cash}% ${cash + card}%, #f97316 ${cash + card}% ${invoiceEnd}%, #94a3b8 ${invoiceEnd}% 100%)"></div>
      <ul class="legend">
        <li><span class="dot dot--cash"></span>${escapeXml(report.labels.cash)} <strong>${escapeXml(formatEuro(report.paymentTotals.cash))}</strong></li>
        <li><span class="dot dot--card"></span>${escapeXml(report.labels.card)} <strong>${escapeXml(formatEuro(report.paymentTotals.card))}</strong></li>
        <li><span class="dot dot--invoice"></span>${escapeXml(report.labels.invoice)} <strong>${escapeXml(formatEuro(report.paymentTotals.invoice))}</strong></li>
        ${report.paymentTotals.unknown > 0 ? `<li><span class="dot dot--unknown"></span>${escapeXml(report.labels.unknownPayment)} <strong>${escapeXml(formatEuro(report.paymentTotals.unknown))}</strong></li>` : ''}
      </ul>
    </section>
  `;
}

function renderDriverPdfHtml(report) {
  return `
    <!doctype html>
    <html lang="${escapeXml(report.language)}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeXml(report.labels.driverReport)} - ${escapeXml(report.monthLabel)}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 0; }
          body { margin: 0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; background: #f8fafc; }
          .page { min-height: 100vh; padding: 22px; background: #ffffff; border: 1px solid #d8e0ec; }
          .top { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; }
          .brand { display: inline-flex; align-items: center; gap: 10px; color: #0f172a; font-size: 15px; font-weight: 800; }
          .brand-mark { width: 28px; height: 28px; border-radius: 9px 9px 14px 14px; background: linear-gradient(145deg, #0f172a, #1d4ed8); transform: rotate(45deg); display: inline-block; }
          h1 { margin: 18px 0 4px; font-size: 28px; line-height: 1; }
          .month { margin: 0; color: #2563eb; font-size: 20px; font-weight: 800; }
          .stamp { margin-top: 38px; color: #475569; font-size: 11px; text-align: right; }
          .stamp strong { display: block; color: #0f172a; margin-top: 4px; }
          .info-card { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 18px; overflow: hidden; border: 1px solid #dbe7f7; border-radius: 10px; background: #dbe7f7; }
          .info-item { padding: 14px; background: #f8fbff; }
          .info-item span { display: block; color: #64748b; font-size: 11px; font-weight: 800; }
          .info-item strong { display: block; margin-top: 6px; font-size: 13px; }
          h2 { margin: 0 0 12px; font-size: 16px; }
          .section-title { margin: 22px 0 12px; font-size: 16px; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .metric { min-height: 82px; padding: 15px; border: 1px solid #dbe7f7; border-radius: 10px; background: #f8fbff; text-align: center; }
          .metric span { display: block; color: #334155; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .metric strong { display: block; margin-top: 12px; font-size: 23px; }
          .metric--green { background: #ecfdf5; border-color: #bbf7d0; color: #15803d; }
          .content-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; margin-top: 16px; }
          .net-box { display: grid; place-items: center; min-height: 110px; border: 1px solid #bbf7d0; border-radius: 10px; background: #ecfdf5; color: #15803d; text-align: center; }
          .net-box span { display: block; font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .net-box strong { display: block; margin-top: 8px; font-size: 31px; }
          .side-list { display: grid; align-content: center; gap: 8px; padding: 14px; border: 1px solid #dbe7f7; border-radius: 10px; background: #f8fbff; }
          .side-list p { display: flex; justify-content: space-between; gap: 12px; margin: 0; color: #475569; font-size: 12px; font-weight: 700; }
          .side-list strong { color: #0f172a; }
          .panel { margin-top: 16px; padding: 14px; border: 1px solid #dbe7f7; border-radius: 10px; background: #ffffff; }
          .bar-chart { display: grid; grid-template-columns: repeat(31, 1fr); gap: 5px; height: 182px; align-items: end; padding: 14px 4px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
          .bar-column { display: grid; grid-template-rows: 1fr auto; gap: 6px; height: 100%; align-items: end; text-align: center; }
          .bar { display: block; min-height: 3px; border-radius: 5px 5px 2px 2px; background: linear-gradient(180deg, #3b82f6, #1d4ed8); }
          .bar-column small { color: #64748b; font-size: 8px; }
          .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 8px 9px; border-bottom: 1px solid #e2e8f0; text-align: left; }
          th { color: #334155; font-size: 10px; background: #f8fafc; }
          .payment-panel { display: grid; grid-template-columns: auto 1fr; column-gap: 18px; align-items: center; }
          .payment-panel h2 { grid-column: 1 / -1; }
          .donut { width: 92px; height: 92px; border-radius: 50%; position: relative; }
          .donut::after { content: ""; position: absolute; inset: 23px; border-radius: 50%; background: #ffffff; }
          .legend { display: grid; gap: 9px; margin: 0; padding: 0; list-style: none; font-size: 11px; color: #475569; }
          .legend li { display: flex; align-items: center; gap: 8px; }
          .legend strong { margin-left: auto; color: #0f172a; }
          .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
          .dot--cash { background: #16a34a; }
          .dot--card { background: #2563eb; }
          .dot--invoice { background: #f97316; }
          .dot--unknown { background: #94a3b8; }
          .footer { display: flex; justify-content: space-between; margin-top: 18px; padding: 12px; border-radius: 8px; background: #eff6ff; color: #475569; font-size: 10px; font-weight: 700; }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="top">
            <div>
              ${renderLogo(report)}
              <h1>${escapeXml(report.labels.driverReport)}</h1>
              <p class="month">${escapeXml(report.monthLabel)}</p>
            </div>
            <p class="stamp">${escapeXml(report.labels.dateGenerated)}<strong>${escapeXml(report.generatedAtLabel)}</strong></p>
          </header>

          <section class="info-card">
            <div class="info-item"><span>${escapeXml(report.labels.driver)}</span><strong>${escapeXml(report.profile.driverName)}</strong></div>
            <div class="info-item"><span>${escapeXml(report.labels.period)}</span><strong>${escapeXml(report.periodLabel)}</strong></div>
          </section>

          <h2 class="section-title">${escapeXml(report.labels.monthlySummary)}</h2>
          <section class="metrics">
            ${renderMetricCard(report.labels.grossIncome, formatEuro(report.summary.grossIncome))}
            ${renderMetricCard(report.labels.orders, String(report.summary.totalOrders))}
            ${renderMetricCard(report.labels.commissions, formatEuro(report.summary.totalCommission))}
          </section>

          <section class="content-grid">
            <div class="net-box"><span>${escapeXml(report.labels.netIncome)}</span><strong>${escapeXml(formatEuro(report.summary.netIncome))}</strong></div>
            <div class="side-list">
              <p><span>${escapeXml(report.labels.activeDays)}</span><strong>${report.summary.activeDays}</strong></p>
              <p><span>${escapeXml(report.labels.averageOrder)}</span><strong>${escapeXml(formatEuro(report.summary.averageOrder))}</strong></p>
              <p><span>${escapeXml(report.labels.mileage)}</span><strong>${Math.round(report.summary.mileageKm).toLocaleString('en-GB')} km</strong></p>
              <p><span>${escapeXml(report.labels.bestDay)}</span><strong>${report.summary.bestDay.date ? `${escapeXml(formatDate(report.summary.bestDay.date))} (${escapeXml(formatEuro(report.summary.bestDay.amount))})` : '-'}</strong></p>
            </div>
          </section>

          ${renderChart(report)}

          <section class="bottom-grid">
            ${renderTopDays(report)}
            ${renderPaymentSummary(report)}
          </section>

          <footer class="footer">
            <span>${escapeXml(report.labels.reportFootnote)}</span>
            <span>${escapeXml(report.labels.page)} 1 ${escapeXml(report.labels.pageOf)} 1</span>
          </footer>
        </main>
      </body>
    </html>
  `;
}

function renderAccountantRows(report) {
  return report.orderRows.map(order => `
    <tr>
      <td>${escapeXml(order.dateLabel)}</td>
      <td>${escapeXml(order.id)}</td>
      <td>${escapeXml(order.providerLabel)}</td>
      <td>${escapeXml(order.fromAddress || '-')}</td>
      <td>${escapeXml(order.toAddress || '-')}</td>
      <td class="num">${escapeXml(formatEuroPlain(order.amount))}</td>
      <td class="num">${escapeXml(formatEuroPlain(order.commission))}</td>
    </tr>
  `).join('');
}

function renderAccountantPdfHtml(report) {
  return `
    <!doctype html>
    <html lang="${escapeXml(report.language)}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeXml(report.labels.accountantData)} - ${escapeXml(report.monthLabel)}</title>
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 0; }
          body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; background: #ffffff; }
          .page { min-height: 100vh; padding: 22px; border: 1px solid #d1d5db; }
          .brand { display: inline-flex; align-items: center; gap: 10px; color: #0f172a; font-size: 15px; font-weight: 800; }
          .brand-mark { width: 28px; height: 28px; border-radius: 9px 9px 14px 14px; background: linear-gradient(145deg, #0f172a, #1d4ed8); transform: rotate(45deg); display: inline-block; }
          .title { margin: 22px 0 24px; text-align: center; }
          h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
          .title p { margin: 6px 0 0; font-size: 13px; }
          h2 { margin: 24px 0 8px; padding-bottom: 7px; border-bottom: 1px solid #9ca3af; font-size: 14px; }
          .facts { width: 100%; border-collapse: collapse; font-size: 12px; }
          .facts td { padding: 5px 0; border: 0; }
          .facts td:first-child { width: 140px; color: #374151; font-weight: 700; }
          .summary-row { display: flex; justify-content: space-between; gap: 16px; margin: 8px 0; font-size: 13px; }
          .summary-row strong { margin-left: auto; }
          .net { display: flex; justify-content: space-between; margin-top: 16px; padding: 12px 14px; border: 1px solid #bbf7d0; background: #ecfdf5; color: #15803d; font-size: 16px; font-weight: 800; }
          table.entries { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: 8.8px; table-layout: fixed; }
          .entries thead { display: table-header-group; }
          .entries th { background: #f3f4f6; color: #111827; font-weight: 800; }
          .entries th, .entries td { padding: 6px 5px; border: 1px solid #d1d5db; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
          .entries th:nth-child(1), .entries td:nth-child(1) { width: 10%; }
          .entries th:nth-child(2), .entries td:nth-child(2) { width: 18%; }
          .entries th:nth-child(3), .entries td:nth-child(3) { width: 18%; }
          .entries th:nth-child(4), .entries td:nth-child(4) { width: 18%; }
          .entries th:nth-child(5), .entries td:nth-child(5) { width: 18%; }
          .entries th:nth-child(6), .entries td:nth-child(6),
          .entries th:nth-child(7), .entries td:nth-child(7) { width: 9%; }
          .entries .num { text-align: right; }
          .total-row td { background: #ecfdf5; color: #15803d; font-weight: 800; text-transform: uppercase; }
          .footer { display: flex; justify-content: space-between; margin-top: 24px; color: #374151; font-size: 11px; }
        </style>
      </head>
      <body>
        <main class="page">
          ${renderLogo(report)}
          <section class="title">
            <h1>${escapeXml(report.labels.accountantData)}</h1>
            <p>(${escapeXml(report.labels.accountantDataSubtitle)})</p>
            <p>${escapeXml(report.labels.period)}: ${escapeXml(report.periodLabel)}</p>
          </section>

          <h2>${escapeXml(report.labels.proprietor)}</h2>
          <table class="facts">
            <tr><td>${escapeXml(report.labels.name)}:</td><td>${escapeXml(report.profile.driverName)}</td></tr>
            <tr><td>${escapeXml(report.labels.ico)}:</td><td>${escapeXml(report.profile.ico || '-')}</td></tr>
            <tr><td>${escapeXml(report.labels.address)}:</td><td>${escapeXml(report.profile.address || '-')}</td></tr>
            <tr><td>${escapeXml(report.labels.dic)}:</td><td>${escapeXml(report.profile.dic || '-')}</td></tr>
          </table>

          <h2>${escapeXml(report.labels.incomeSummary)}</h2>
          <p class="summary-row"><span>${escapeXml(report.labels.totalJobs)}</span><strong>${report.summary.totalOrders}</strong></p>
          <p class="summary-row"><span>${escapeXml(report.labels.totalIncome)}</span><strong>${escapeXml(formatEuro(report.summary.grossIncome))}</strong></p>

          <h2>${escapeXml(report.labels.expenseSummary)}</h2>
          <p class="summary-row"><span>${escapeXml(report.labels.commissions)}</span><strong>${escapeXml(formatEuro(report.summary.totalCommission))}</strong></p>
          <p class="net"><span>${escapeXml(report.labels.incomeAfterCommissions)}</span><strong>${escapeXml(formatEuro(report.summary.netIncome))}</strong></p>

          <h2>${escapeXml(report.labels.incomeOverview)}</h2>
          <table class="entries">
            <thead>
              <tr>
                <th>${escapeXml(report.labels.date)}</th>
                <th>${escapeXml(report.labels.documentId)}</th>
                <th>${escapeXml(report.labels.provider)}</th>
                <th>${escapeXml(report.labels.from)}</th>
                <th>${escapeXml(report.labels.to)}</th>
                <th>${escapeXml(report.labels.income)} (EUR)</th>
                <th>${escapeXml(report.labels.expense)} (EUR)</th>
              </tr>
            </thead>
            <tbody>
              ${renderAccountantRows(report)}
              <tr class="total-row">
                <td colspan="5">${escapeXml(report.labels.totalIncomeRow)}</td>
                <td class="num">${escapeXml(formatEuroPlain(report.summary.grossIncome))}</td>
                <td class="num">${escapeXml(formatEuroPlain(report.summary.totalCommission))}</td>
              </tr>
            </tbody>
          </table>

          <footer class="footer">
            <span>${escapeXml(report.labels.accountantNote)}</span>
            <span>${escapeXml(report.labels.preparedAt)}: ${escapeXml(formatDate(report.generatedAt))}</span>
            <strong>${escapeXml(report.profile.driverName)}</strong>
          </footer>
        </main>
      </body>
    </html>
  `;
}

function xmlCell(value, type = 'String', styleId = '') {
  const style = styleId ? ` ss:StyleID="${escapeXml(styleId)}"` : '';

  return `<Cell${style}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function xmlRow(cells, styleId = '') {
  const style = styleId ? ` ss:StyleID="${escapeXml(styleId)}"` : '';

  return `<Row${style}>${cells.join('')}</Row>`;
}

function buildExcelXml(report) {
  const labels = report.labels;
  const rows = report.orderRows.map(order => xmlRow([
    xmlCell(order.dateLabel),
    xmlCell(order.timeLabel),
    xmlCell(order.id),
    xmlCell(order.paymentLabel),
    xmlCell(order.providerLabel),
    xmlCell(order.fromAddress || '-'),
    xmlCell(order.toAddress || '-'),
    xmlCell(formatExcelNumber(order.amount), 'Number', 'Money'),
    xmlCell(formatExcelNumber(order.commission), 'Number', 'Money'),
    xmlCell(formatExcelNumber(order.net), 'Number', 'Money'),
  ]));

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Arial" ss:Size="11"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Header">
      <Interior ss:Color="#EAF7EF" ss:Pattern="Solid"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D6E4"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D6E4"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D6E4"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C8D6E4"/>
      </Borders>
    </Style>
    <Style ss:ID="Money">
      <NumberFormat ss:Format="0.00"/>
    </Style>
    <Style ss:ID="Total">
      <Interior ss:Color="#EAF7EF" ss:Pattern="Solid"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <NumberFormat ss:Format="0.00"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Orders">
    <Table>
      <Column ss:Width="78"/>
      <Column ss:Width="52"/>
      <Column ss:Width="150"/>
      <Column ss:Width="88"/>
      <Column ss:Width="190"/>
      <Column ss:Width="250"/>
      <Column ss:Width="250"/>
      <Column ss:Width="74"/>
      <Column ss:Width="74"/>
      <Column ss:Width="74"/>
      ${xmlRow([xmlCell(`${report.profile.driverName} - ${report.monthLabel}`, 'String', 'Title')])}
      ${xmlRow([xmlCell(labels.excelSubtitle, 'String', 'Subtitle')])}
      ${xmlRow([])}
      ${xmlRow([
        xmlCell(labels.date, 'String', 'Header'),
        xmlCell(labels.time, 'String', 'Header'),
        xmlCell(labels.id, 'String', 'Header'),
        xmlCell(labels.paymentType, 'String', 'Header'),
        xmlCell(labels.provider, 'String', 'Header'),
        xmlCell(labels.from, 'String', 'Header'),
        xmlCell(labels.to, 'String', 'Header'),
        xmlCell(labels.income, 'String', 'Header'),
        xmlCell(labels.commission, 'String', 'Header'),
        xmlCell(labels.netIncome, 'String', 'Header'),
      ])}
      ${rows.join('')}
      ${xmlRow([
        xmlCell(labels.total, 'String', 'Header'),
        xmlCell(''),
        xmlCell(''),
        xmlCell(''),
        xmlCell(''),
        xmlCell(''),
        xmlCell(''),
        xmlCell(formatExcelNumber(report.summary.grossIncome), 'Number', 'Total'),
        xmlCell(formatExcelNumber(report.summary.totalCommission), 'Number', 'Total'),
        xmlCell(formatExcelNumber(report.summary.netIncome), 'Number', 'Total'),
      ])}
      ${xmlRow([])}
      ${xmlRow([xmlCell(labels.monthlySummary, 'String', 'Header')])}
      ${xmlRow([xmlCell(labels.orders), xmlCell(report.summary.totalOrders, 'Number')])}
      ${xmlRow([xmlCell(labels.grossIncome), xmlCell(formatExcelNumber(report.summary.grossIncome), 'Number', 'Money')])}
      ${xmlRow([xmlCell(labels.commissions), xmlCell(formatExcelNumber(report.summary.totalCommission), 'Number', 'Money')])}
      ${xmlRow([xmlCell(labels.netIncome), xmlCell(formatExcelNumber(report.summary.netIncome), 'Number', 'Money')])}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>4</SplitHorizontal>
      <TopRowBottomPane>4</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;
}

function sanitizeFileNamePart(value) {
  return String(value || 'report')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'report';
}

export async function createTaxDriverPdf(report) {
  return {
    buffer: await renderPdfFromHtml(renderDriverPdfHtml(report)),
    fileName: `tax-driver-report-${sanitizeFileNamePart(report.monthKey)}.pdf`,
  };
}

export async function createTaxAccountantPdf(report) {
  return {
    buffer: await renderPdfFromHtml(renderAccountantPdfHtml(report)),
    fileName: `tax-accountant-data-${sanitizeFileNamePart(report.monthKey)}.pdf`,
  };
}

export function createTaxExcelReport(report) {
  return {
    buffer: Buffer.from(buildExcelXml(report), 'utf8'),
    fileName: `tax-orders-${sanitizeFileNamePart(report.monthKey)}.xls`,
  };
}

export function getTaxReportContentType(type) {
  if (type === 'excel') {
    return 'application/vnd.ms-excel; charset=utf-8';
  }

  return 'application/pdf';
}
