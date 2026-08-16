import { useI18n } from '@shared/app/i18n/useI18n.js';
import './StatsUsagePanel.css';

function parseDateValue(value) {
  // Перетворюємо рядок дати у Date.
  if (!value) return null;

  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00`
    : /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)
      ? text.replace(' ', 'T')
      : text;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatShortDate(value) {
  // Форматуємо дату компактно для картки циклу.
  const date = parseDateValue(value);

  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getCycleLabel(usage) {
  // Повертаємо короткий напис для поточного циклу.
  if (usage?.month) {
    const monthText = String(usage.month);

    if (/^\d{4}-\d{2}$/.test(monthText)) {
      const [year, month] = monthText.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);

      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', {
          month: 'short',
          year: 'numeric',
        }).format(date);
      }
    }

    return monthText;
  }

  if (usage?.cycleLabel) {
    const text = String(usage.cycleLabel);

    if (text.includes(' - ')) {
      return text.split(' - ')[0];
    }

    return text;
  }

  const start = formatShortDate(usage?.periodStart);

  if (start === '-') {
    return 'Current cycle';
  }

  return start;
}

export function StatsUsagePanel({ usage, orders }) {
  const { t } = useI18n();
  const percent = usage.percent || 0;
  const cycleLabel = getCycleLabel(usage);
  const planLimitLabel = usage.limit
    ? `${usage.used} / ${usage.limit} ${t('stats.ordersUnit')}`
    : t('stats.noDataLabel');
  const remainingLabel = String(usage.remaining || 0);
  const totalOrders = String(usage.orderCount ?? orders.length ?? 0);
  const deletedMessagesLabel = String(usage.deletedMessages || 0);
  return (
    <section className="statsPanel is-active">
      <div className="statsHero">
        <div className="statsRing" style={{ '--progress': `${percent}%` }}>
          <div className="statsRing-inner">
            <strong>{percent}%</strong>
            <span>{t('stats.percentUsed', { percent })}</span>
          </div>
        </div>

        <div className="statsMiniGrid">
          <article className="statsMiniCard">
            <span>{t('stats.cycle')}</span>
            <strong>{cycleLabel}</strong>
          </article>
          <article className="statsMiniCard">
            <span>{t('stats.used')}</span>
            <strong>{usage.used}</strong>
          </article>
          <article className="statsMiniCard">
            <span>{t('stats.remaining')}</span>
            <strong>{remainingLabel}</strong>
          </article>
          <article className="statsMiniCard">
            <span>{t('stats.deleted')}</span>
            <strong>{deletedMessagesLabel}</strong>
          </article>
        </div>
      </div>

      <div className="usageCard usageCard-stats">
        <div className="usageCard-head">
          <h3>{t('stats.cycleLimit')}</h3>
          <span>{planLimitLabel}</span>
        </div>
        <div className="usageBar">
          <div className="usageBar-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="usageForecast">
          <article className="usageForecast-card">
            <span>{t('stats.available')}</span>
            <strong>{remainingLabel}</strong>
            <p>{t('stats.availableDocs')}</p>
          </article>
          <article className="usageForecast-card">
            <span>{t('stats.total')}</span>
            <strong>{totalOrders}</strong>
            <p>{t('stats.storedOrders')}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
