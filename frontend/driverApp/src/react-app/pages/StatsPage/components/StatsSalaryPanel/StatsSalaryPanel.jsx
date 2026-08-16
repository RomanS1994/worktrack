import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getDateKey, parseDateValue } from '../../../shared/dateUtils.js';
import './StatsSalaryPanel.css';

const EUR_RATE = 25;

function getMonthRange(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getMonthLabel(language, referenceDate = new Date()) {
  const locale = language === 'uk' ? 'uk-UA' : language === 'cs' ? 'cs-CZ' : 'en-GB';

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(referenceDate);
}

function getExecutionDate(order) {
  return order?.contractData?.trip?.time || order?.trip?.time || '';
}

function getMonthOrders(orders, referenceDate = new Date()) {
  const { start, end } = getMonthRange(referenceDate);

  return orders.filter(order => {
    const date = parseDateValue(getExecutionDate(order));

    if (!date) {
      return false;
    }

    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  });
}

function parseMoneyValue(value) {
  // Дістаємо число і валюту з текстового поля суми.
  if (value === null || value === undefined) {
    return {
      amount: 0,
      currency: 'EUR',
    };
  }

  const text = String(value).trim();
  const currencyMatch = text.match(/\b(EUR|CZK)\b/i);
  const amountMatch = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0]) : 0;
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'EUR';

  if (!Number.isFinite(amount)) {
    return {
      amount: 0,
      currency,
    };
  }

  return {
    amount,
    currency,
  };
}

function getOrderCommission(order) {
  return parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
}

function getOrderNetAmount(order) {
  return parseMoneyValue(order?.totalPrice || order?.contractData?.totalPrice);
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

function toCzkAmount(value, currency) {
  return convertAmount(value, currency, 'CZK');
}

function formatMoney(value) {
  // Форматуємо суму для красивого великого числа.
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function getDayLabel(date) {
  // Показуємо коротку назву дня у зрозумілому форматі.
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
  }).format(date);
}

function getTopDays(orders) {
  // Рахуємо найсильніші дні по сумі замовлень.
  const totals = new Map();

  for (const order of orders) {
    const date = parseDateValue(getExecutionDate(order));

    if (!date) {
      continue;
    }

    const key = getDateKey(date);
    const gross = getOrderNetAmount(order);
    const commission = getOrderCommission(order);
    const amount = toCzkAmount(gross.amount, gross.currency) - toCzkAmount(commission.amount, commission.currency);

    if (!totals.has(key)) {
      totals.set(key, {
        key,
        label: getDayLabel(date),
        amount: 0,
      });
    }

    const item = totals.get(key);
    item.amount += amount;
  }

  return Array.from(totals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);
}

export function StatsSalaryPanel({ orders, usage }) {
  const { language, t } = useI18n();
  const monthLabel = getMonthLabel(language);
  const monthOrders = getMonthOrders(orders);
  const grossTotal = monthOrders.reduce((sum, order) => {
    const gross = getOrderNetAmount(order);
    return sum + toCzkAmount(gross.amount, gross.currency);
  }, 0);
  const commissionTotal = monthOrders.reduce((sum, order) => {
    const commission = getOrderCommission(order);
    return sum + toCzkAmount(commission.amount, commission.currency);
  }, 0);
  const netSalary = grossTotal - commissionTotal;
  const takeHomeShare = grossTotal
    ? Math.min(100, Math.round((netSalary / grossTotal) * 100))
    : 0;
  const bestDays = getTopDays(monthOrders);
  const topDay = bestDays[0];
  const monthCount = monthOrders.length;
  const avgRide = monthCount ? netSalary / monthCount : 0;

  return (
    <section className="statsPanel is-active statsSalaryPanel">
      <div className="salaryHeroCard">
        <div className="salaryHeroMain">
          <p className="sectionEyebrow">{t('stats.salary')}</p>
          <h3>{t('stats.salaryTitle')}</h3>
          <strong>{formatMoney(netSalary)} CZK</strong>
          <p>
            {t('stats.mainPayout')} {monthCount} orders.
          </p>
        </div>

        <div className="salaryHeroAside">
          <div className="salaryHeroStat">
            <span>{t('stats.gross')}</span>
            <strong>
              {formatMoney(grossTotal)} CZK
            </strong>
          </div>
          <div className="salaryHeroStat">
            <span>{t('stats.commission')}</span>
            <strong>
              {formatMoney(commissionTotal)} CZK
            </strong>
          </div>
          <div className="salaryHeroStat">
            <span>{t('stats.netShare')}</span>
            <strong>{takeHomeShare}%</strong>
          </div>
        </div>
      </div>

      <div className="salaryLedgerCard">
        <div className="usageCard-head">
          <h3>{t('stats.payoutBreakdown')}</h3>
          <span>{monthLabel}</span>
        </div>

        <div className="salaryLedger">
          <article className="salaryLedgerRow">
            <div className="salaryLedgerRow-copy">
              <span>{t('stats.netSalary')}</span>
              <p>{t('stats.mainPayout')}</p>
            </div>
            <strong>{formatMoney(netSalary)} CZK</strong>
          </article>
          <article className="salaryLedgerRow">
            <div className="salaryLedgerRow-copy">
              <span>{t('stats.totalCommission')}</span>
              <p>{t('stats.commissionValues')}</p>
            </div>
            <strong>{formatMoney(commissionTotal)} CZK</strong>
          </article>
          <article className="salaryLedgerRow">
            <div className="salaryLedgerRow-copy">
              <span>{t('stats.averageRide')}</span>
              <p>{t('stats.averageNet')}</p>
            </div>
            <strong>{formatMoney(avgRide)} CZK</strong>
          </article>
        </div>
      </div>

      <div className="salaryTrendCard">
        <div className="usageCard-head">
          <h3>{t('stats.topEarningDays')}</h3>
          <span>{topDay ? topDay.label : t('stats.noData')}</span>
        </div>

        <div className="salaryTrendList">
          {bestDays.length ? (
            bestDays.map((day, index) => {
              const highest = bestDays[0]?.amount || 1;
              const width = Math.max(16, Math.round((day.amount / highest) * 100));

              return (
                <article key={day.key} className="salaryTrendRow">
                  <div className="salaryTrendRow-head">
                    <span>{day.label}</span>
                    <strong>{formatMoney(day.amount)} CZK</strong>
                  </div>
                  <div className="salaryTrendTrack">
                    <div
                      className={`salaryTrendFill salaryTrendFill-${index + 1}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <p className="salaryTrendEmpty">{t('stats.noSalaryDataYet')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
