import { useMemo, useRef, useState } from 'react';

import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { WorkspaceTabs } from '../../components/WorkspaceTabs/WorkspaceTabs.jsx';
import { useGetOrdersQuery } from '../../features/orders/ordersApi.js';
import { OrderDetails } from '../../features/orders/components/OrderDetails/OrderDetails.jsx';
import { getOrderTripTime } from '../HistoryPage/historyUtils.js';
import { getDateKey, parseDateValue } from '../shared/dateUtils.js';
import './CalendarPage.css';

const EUR_RATE = 25;
const DEFAULT_ORDER_DURATION_MINUTES = 90;
const MIN_ORDER_DURATION_MINUTES = 45;
const MAX_ORDER_DURATION_MINUTES = 360;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 18;
const HOUR_HEIGHT = 52;
const EVENT_HEIGHT = 52;
const EVENT_GAP = 6;

function getLocale(language) {
  if (language === 'uk') return 'uk-UA';
  if (language === 'cs') return 'cs-CZ';
  return 'en-GB';
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

function getWeekStart(value) {
  const date = startOfDay(value);
  const day = date.getDay();
  const mondayOffset = (day + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function getWeekDays(value) {
  const start = getWeekStart(value);
  return Array.from({ length: 7 }, (_item, index) => addDays(start, index));
}

function toDateInputValue(value) {
  const date = startOfDay(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, fallback) {
  const parts = String(value || '').split('-').map(part => Number.parseInt(part, 10));

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return fallback;
  }

  return startOfDay(new Date(parts[0], parts[1] - 1, parts[2]));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getLocationLabel(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return normalizeText(value);
  }

  return normalizeText(value.address || value.name || value.label);
}

function normalizeAddressForMatch(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isPrgAirportAddress(value) {
  const address = normalizeAddressForMatch(value);

  if (!address) {
    return false;
  }

  return (
    address.includes('letiste vaclava havla praha') ||
    address.includes('vaclav havel airport prague') ||
    (
      address.includes('prg') &&
      address.includes('aviaticka') &&
      (address.includes('praha 6') || address.includes('prague 6'))
    )
  );
}

function getCalendarEventColor(order) {
  const trip = order?.contractData?.trip || order?.trip || {};
  const from = getLocationLabel(trip.from);
  const to = getLocationLabel(trip.to);

  if (isPrgAirportAddress(to)) {
    return 'green';
  }

  if (isPrgAirportAddress(from)) {
    return 'brick';
  }

  return 'blue';
}

function getOrderRoute(order, t) {
  const trip = order?.contractData?.trip || order?.trip || {};
  const from = getLocationLabel(trip.from);
  const to = getLocationLabel(trip.to);

  if (!from || !to) {
    return t('history.routeNotAdded');
  }

  return `${from} -> ${to}`;
}

function getOrderRouteParts(order, t) {
  const trip = order?.contractData?.trip || order?.trip || {};
  const from = getLocationLabel(trip.from);
  const to = getLocationLabel(trip.to);

  return {
    from: from || t('history.routeNotAdded'),
    to: to || t('history.routeNotAdded'),
  };
}

function getCalendarCustomerName(order, t) {
  return (
    order?.contractData?.customer?.name ||
    order?.customer?.name ||
    t('history.customerNotSpecified')
  );
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

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

function getOrderNetEur(order) {
  const gross = parseMoneyValue(order?.totalPrice || order?.contractData?.totalPrice);
  const commission = parseMoneyValue(order?.metadata?.commission || order?.contractData?.commission);
  const grossCzk = convertAmount(gross.amount, gross.currency, 'CZK');
  const commissionCzk = convertAmount(commission.amount, commission.currency, 'CZK');
  const netCzk = Math.max(0, grossCzk - commissionCzk);

  return convertAmount(netCzk, 'CZK', 'EUR');
}

function formatEur(value) {
  const amount = Math.round(Number(value) || 0);
  return `${amount.toLocaleString('en-GB')} EUR`;
}

function parseDurationText(value) {
  const text = normalizeText(value).toLowerCase().replace(',', '.');

  if (!text) {
    return 0;
  }

  const directMinutes = Number.parseInt(text, 10);

  if (Number.isFinite(directMinutes) && /^\d+$/.test(text)) {
    return directMinutes;
  }

  const clockMatch = text.match(/^(\d{1,2}):(\d{2})$/);

  if (clockMatch) {
    return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
  }

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hours|год|годин|hod|hodin)/);
  const minutesMatch = text.match(/(\d+)\s*(?:m|min|minute|minutes|хв|minut)/);
  const hours = hoursMatch ? Number(hoursMatch[1]) * 60 : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  return Math.round(hours + minutes);
}

function getOrderDurationMinutes(order) {
  const trip = order?.contractData?.trip || order?.trip || {};
  const candidates = [
    order?.metadata?.durationMinutes,
    order?.metadata?.workDurationMinutes,
    order?.metadata?.workingMinutes,
    trip.durationMinutes,
    trip.workDurationMinutes,
    trip.workingMinutes,
    trip.duration,
    trip.workDuration,
  ];

  for (const candidate of candidates) {
    const minutes = typeof candidate === 'number' ? candidate : parseDurationText(candidate);

    if (Number.isFinite(minutes) && minutes > 0) {
      return Math.min(MAX_ORDER_DURATION_MINUTES, Math.max(MIN_ORDER_DURATION_MINUTES, minutes));
    }
  }

  return DEFAULT_ORDER_DURATION_MINUTES;
}

function formatTime(value, language) {
  return new Intl.DateTimeFormat(getLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatDuration(minutes, language) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;

  if (language === 'uk') {
    if (!hours) return `${rest} хв`;
    if (!rest) return `${hours} год`;
    return `${hours} год ${rest} хв`;
  }

  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function formatWeekday(value, language) {
  return capitalize(
    new Intl.DateTimeFormat(getLocale(language), {
      weekday: 'short',
    })
      .format(value)
      .replace('.', ''),
  );
}

function formatDateTitle(value, language, t) {
  const locale = getLocale(language);
  const label = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  }).format(value);

  if (getDateKey(value) === getDateKey(new Date())) {
    return `${t('calendar.todayPrefix')}, ${label}`;
  }

  return capitalize(label);
}

function buildCalendarEvent(order, language, t) {
  const tripDate = parseDateValue(getOrderTripTime(order));

  if (!tripDate) {
    return null;
  }

  const durationMinutes = getOrderDurationMinutes(order);
  const startMinutes = tripDate.getHours() * 60 + tripDate.getMinutes();
  const passengers = normalizeCount(order?.contractData?.passengers || order?.passengers);
  const price = getOrderNetEur(order);
  const routeParts = getOrderRouteParts(order, t);

  return {
    id: order.id,
    color: getCalendarEventColor(order),
    customer: getCalendarCustomerName(order, t),
    date: tripDate,
    durationMinutes,
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
    time: formatTime(tripDate, language),
    route: getOrderRoute(order, t),
    routeFrom: routeParts.from,
    routeTo: routeParts.to,
    passengers,
    price,
    priceLabel: price > 0 ? formatEur(price) : t('history.noPrice'),
  };
}

function getTimelineBounds(events) {
  if (!events.length) {
    return {
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
    };
  }

  const earliestHour = Math.floor(Math.min(...events.map(event => event.startMinutes)) / 60);
  const latestHour = Math.ceil(Math.max(...events.map(event => event.endMinutes)) / 60);

  return {
    startHour: Math.max(0, Math.min(DEFAULT_START_HOUR, earliestHour - 1)),
    endHour: Math.min(24, Math.max(DEFAULT_END_HOUR, latestHour + 1)),
  };
}

function CalendarStat({ value, label }) {
  return (
    <div className="calendarStat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CalendarEvent({ event, top, height, passengersLabel, onOpen }) {
  return (
    <button
      className={`calendarEvent calendarEvent--${event.color}`}
      type="button"
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
      onClick={() => onOpen(event.id)}
      aria-label={`${event.time}. ${event.customer}. ${event.route}.`}
    >
      <span className="calendarEvent-time">{event.time}</span>
      <span className="calendarEvent-main">
        <strong>{event.customer}</strong>
        <span className="calendarEvent-route">
          <span>{event.routeFrom}</span>
          <span className="calendarEvent-routeArrow" aria-hidden="true">→</span>
          <span>{event.routeTo}</span>
        </span>
        <span className="calendarEvent-meta">
          <span className="calendarEvent-passengers" aria-label={passengersLabel}>
            <SvgIcon name="accounts" />
            <span>{event.passengers}</span>
          </span>
          <strong className="calendarEvent-price">{event.priceLabel}</strong>
        </span>
      </span>
    </button>
  );
}

export function CalendarPage() {
  const { language, t } = useI18n();
  const dateInputRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const { data, isLoading, isError } = useGetOrdersQuery({ limit: 1000 });
  const orders = data?.orders || [];
  const selectedDateKey = getDateKey(selectedDate);

  const dayOrders = useMemo(() => {
    return orders
      .filter(order => getDateKey(getOrderTripTime(order)) === selectedDateKey)
      .sort((left, right) => {
        const leftTime = parseDateValue(getOrderTripTime(left))?.getTime() || 0;
        const rightTime = parseDateValue(getOrderTripTime(right))?.getTime() || 0;
        return leftTime - rightTime;
      });
  }, [orders, selectedDateKey]);

  const events = useMemo(() => {
    return dayOrders
      .map(order => buildCalendarEvent(order, language, t))
      .filter(Boolean);
  }, [dayOrders, language, t]);

  const timelineBounds = useMemo(() => getTimelineBounds(events), [events]);
  const hours = useMemo(() => {
    const count = Math.max(1, timelineBounds.endHour - timelineBounds.startHour);
    return Array.from({ length: count }, (_item, index) => timelineBounds.startHour + index);
  }, [timelineBounds.endHour, timelineBounds.startHour]);
  const eventLayouts = useMemo(() => {
    let nextTop = 0;

    return events.map(event => {
      const nominalTop = ((event.startMinutes - timelineBounds.startHour * 60) / 60) * HOUR_HEIGHT;
      const top = Math.max(nominalTop, nextTop);
      nextTop = top + EVENT_HEIGHT + EVENT_GAP;

      return {
        event,
        height: EVENT_HEIGHT,
        top,
      };
    });
  }, [events, timelineBounds.startHour]);
  const timelineHeight = Math.max(
    hours.length * HOUR_HEIGHT,
    eventLayouts.reduce((max, item) => Math.max(max, item.top + item.height + 14), 0),
  );
  const workMinutes = events.reduce((sum, event) => sum + event.durationMinutes, 0);
  const income = events.reduce((sum, event) => sum + event.price, 0);
  const freeMinutes = Math.max(0, hours.length * 60 - workMinutes);
  const weekDays = getWeekDays(selectedDate);
  const dateInputValue = toDateInputValue(selectedDate);

  function changeDate(offset) {
    setSelectedDate(current => startOfDay(addDays(current, offset)));
  }

  function handleDateInputChange(event) {
    setSelectedDate(current => parseDateInput(event.target.value, current));
  }

  function openDatePicker(event) {
    event.preventDefault();

    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    input.focus({ preventScroll: true });

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Some mobile browsers expose showPicker but still reject it.
      }
    }

    input.click();
  }

  function handleCloseDetails() {
    setSelectedOrderId('');
  }

  return (
    <section className="calendarPage pageStack">
      <WorkspaceTabs />

      <section className="calendarDatePanel" aria-label={t('calendar.dateNavigation')}>
        <div className="calendarDateNav">
          <button
            className="calendarDateButton calendarDateButton--previous"
            type="button"
            onClick={() => changeDate(-1)}
            aria-label={t('calendar.previousDay')}
          >
            <SvgIcon name="back" />
          </button>

          <label className="calendarDatePicker" onClick={openDatePicker}>
            <span>{formatDateTitle(selectedDate, language, t)}</span>
            <span className="calendarDatePicker-caret" aria-hidden="true" />
            <input
              ref={dateInputRef}
              type="date"
              value={dateInputValue}
              onChange={handleDateInputChange}
              aria-label={t('calendar.pickDate')}
            />
          </label>

          <button
            className="calendarDateButton"
            type="button"
            onClick={() => changeDate(1)}
            aria-label={t('calendar.nextDay')}
          >
            <SvgIcon name="chevron-right" />
          </button>
        </div>

        <div className="calendarWeekStrip" role="list" aria-label={t('calendar.week')}>
          {weekDays.map(day => {
            const dayKey = getDateKey(day);
            const isSelected = dayKey === selectedDateKey;

            return (
              <button
                key={dayKey}
                className={`calendarWeekDay${isSelected ? ' is-selected' : ''}`}
                type="button"
                onClick={() => setSelectedDate(day)}
                role="listitem"
                aria-pressed={isSelected}
              >
                <span>{formatWeekday(day, language)}</span>
                <strong>{day.getDate()}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="calendarSummary" aria-label={t('calendar.summary')}>
        <CalendarStat value={String(events.length)} label={t('calendar.orders')} />
        <CalendarStat value={formatEur(income)} label={t('calendar.income')} />
        <CalendarStat value={formatDuration(workMinutes, language)} label={t('calendar.workTime')} />
        <CalendarStat value={formatDuration(freeMinutes, language)} label={t('calendar.freeTime')} />
      </section>

      <section
        className="calendarTimelineCard"
        style={{
          '--calendar-hour-height': `${HOUR_HEIGHT}px`,
          '--calendar-timeline-height': `${timelineHeight}px`,
        }}
        aria-label={t('calendar.timeline')}
      >
        {isLoading ? (
          <RequestLoadingState className="calendarTimelineState" label={t('common.loadingOrders')} />
        ) : null}
        {isError ? <p className="calendarTimelineState">{t('common.failedOrder')}</p> : null}

        {!isLoading && !isError ? (
          <div className="calendarTimeline">
            <div className="calendarTimeline-hours" aria-hidden="true">
              {hours.map(hour => (
                <span key={hour}>{formatHour(hour)}</span>
              ))}
            </div>
            <div className="calendarTimeline-grid">
              {!events.length ? (
                <div className="calendarTimelineEmpty">{t('calendar.empty')}</div>
              ) : null}

              {eventLayouts.map(({ event, height, top }) => {
                return (
                  <CalendarEvent
                    key={event.id}
                    event={event}
                    top={top}
                    height={height}
                    passengersLabel={t('contract.passengers')}
                    onOpen={setSelectedOrderId}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {selectedOrderId ? <OrderDetails orderId={selectedOrderId} onClose={handleCloseDetails} /> : null}
    </section>
  );
}
