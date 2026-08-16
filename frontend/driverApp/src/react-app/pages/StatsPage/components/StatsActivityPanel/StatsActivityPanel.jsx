import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getDateKey, getOrderDate, parseDateValue } from '../../../shared/dateUtils.js';
import './StatsActivityPanel.css';

const ORDER_COMPLETION_DELAY_MS = 60 * 60 * 1000;

function getActivityDate(order) {
  return getOrderDate(order) || order?.createdAt || '';
}

function getMonthRange(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(date, range) {
  if (!date) {
    return false;
  }

  const time = date.getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function getMonthOrders(orders, referenceDate = new Date()) {
  const range = getMonthRange(referenceDate);

  return orders.filter(order => isDateInRange(parseDateValue(getActivityDate(order)), range));
}

function getMonthWeekLabel(startDate, endDate) {
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  return startDay === endDay ? String(startDay) : `${startDay}-${endDay}`;
}

function buildActivitySeries(orders, referenceDate = new Date()) {
  // Рахуємо активність за тижні поточного місяця.
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);

  return Array.from({ length: weekCount }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const startDate = new Date(year, month, startDay, 0, 0, 0, 0);
    const endDate = new Date(year, month, endDay, 23, 59, 59, 999);
    const key = `${getDateKey(startDate)}-${getDateKey(endDate)}`;
    let count = 0;

    for (const order of orders) {
      if (isDateInRange(parseDateValue(getActivityDate(order)), { start: startDate, end: endDate })) {
        count += 1;
      }
    }

    return {
      key,
      count,
      label: getMonthWeekLabel(startDate, endDate),
    };
  });
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

function getOrderStatusBucket(order, referenceDate = new Date()) {
  // Операційний стан важливіший за факт генерації PDF.
  const tripTime = getOrderDate(order);
  const tripDate = parseDateValue(tripTime);

  if (tripDate) {
    if (hasExplicitClockTime(tripTime)) {
      return tripDate.getTime() + ORDER_COMPLETION_DELAY_MS <= referenceDate.getTime()
        ? 'completed'
        : 'planned';
    }

    return getDateKey(tripDate) < getDateKey(referenceDate) ? 'completed' : 'planned';
  }

  const value = String(order?.status || '').toLowerCase();

  if (value === 'completed') {
    return 'completed';
  }

  return 'planned';
}

function buildStatusBreakdown(orders, referenceDate = new Date()) {
  // Рахуємо мікс реальних станів замовлень без PDF-статусу.
  const counts = {
    completed: 0,
    planned: 0,
  };

  for (const order of orders) {
    const bucket = getOrderStatusBucket(order, referenceDate);
    counts[bucket] += 1;
  }

  return counts;
}

function getSummaryLabel(series, t) {
  // Складаємо короткий підсумок за місяць.
  let total = 0;

  for (const item of series) {
    total += item.count;
  }

  return `${total} ${t('stats.ordersThisMonth')}`;
}

export function StatsActivityPanel({ usage, orders }) {
  const { t } = useI18n();
  const referenceDate = new Date();
  const monthOrders = getMonthOrders(orders, referenceDate);
  const series = buildActivitySeries(monthOrders, referenceDate);
  const maxCount = Math.max(1, ...series.map(item => item.count));
  const statusCounts = buildStatusBreakdown(monthOrders, referenceDate);
  const deletedMessagesCount = Number(usage?.deletedMessagesThisMonth || 0);
  const statusTotalRaw = statusCounts.completed + statusCounts.planned + deletedMessagesCount;
  const statusTotal = Math.max(1, statusTotalRaw);
  const summaryLabel = getSummaryLabel(series, t);
  const deletedMessagesLabel = String(deletedMessagesCount);
  const totalLabel = t('stats.total').toLocaleLowerCase();
  const deletedLabel = t('stats.deleted').toLocaleLowerCase();
  return (
    <section className="statsPanel is-active statsActivityPanel">
      <div className="statsVizCard">
        <div className="usageCard-head">
          <h3>{t('stats.thisMonth')}</h3>
          <span>{summaryLabel}</span>
        </div>
        <div
          className="activityBars"
          style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
        >
          {series.map(item => {
            const height = Math.max(12, Math.round((item.count / maxCount) * 100));

            return (
              <div key={item.key} className="activityBarItem">
                <span className="activityBarValue">{item.count}</span>
                <div className="activityBarTrack">
                  <span className="activityBarFill" style={{ height: `${height}%` }} />
                </div>
                <span className="activityBarLabel">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="statsVizCard">
        <div className="usageCard-head">
          <h3>{t('stats.statusMix')}</h3>
          <span>
            {monthOrders.length} {totalLabel} · {deletedMessagesLabel} {deletedLabel}
          </span>
        </div>
        <div className="statusStack">
          {statusTotalRaw ? (
            <>
              <span
                className="statusSegment statusSegment-completed"
                style={{ width: `${(statusCounts.completed / statusTotal) * 100}%` }}
              />
              <span
                className="statusSegment statusSegment-planned"
                style={{ width: `${(statusCounts.planned / statusTotal) * 100}%` }}
              />
              <span
                className="statusSegment statusSegment-deleted"
                style={{ width: `${(deletedMessagesCount / statusTotal) * 100}%` }}
              />
            </>
          ) : (
            <span className="statusSegment statusSegment-empty" style={{ width: '100%' }} />
          )}
        </div>
        <div className="statusLegend">
          <div className="statusLegendItem">
            <span className="statusLegendDot statusLegendDot-completed" />
            <span>{t('history.completed')}</span>
            <strong>{statusCounts.completed}</strong>
          </div>
          <div className="statusLegendItem">
            <span className="statusLegendDot statusLegendDot-planned" />
            <span>{t('history.planned')}</span>
            <strong>{statusCounts.planned}</strong>
          </div>
          <div className="statusLegendItem">
            <span className="statusLegendDot statusLegendDot-deleted" />
            <span>{t('stats.deleted')}</span>
            <strong>{deletedMessagesCount}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
