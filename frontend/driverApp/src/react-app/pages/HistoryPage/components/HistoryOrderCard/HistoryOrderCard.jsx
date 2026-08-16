import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  getCustomerName,
  getHistoryBucket,
  getOrderTripTime,
  getTotalPrice,
  isOrderCompletedByTime,
} from '../../historyUtils.js';
import { getDateKey, parseDateValue } from '../../../shared/dateUtils.js';
import { HistoryRouteModal } from '../HistoryRouteModal/HistoryRouteModal.jsx';
import './HistoryOrderCard.css';

function RouteOpenIcon() {
  return <SvgIcon name="route-open" />;
}

function WalletIcon() {
  return <SvgIcon name="wallet" />;
}

function RouteStartIcon() {
  return <SvgIcon name="today" />;
}

function RouteEndIcon() {
  return <SvgIcon name="completed" />;
}

function FlightIcon() {
  return <SvgIcon name="takeoff" />;
}

function PassengersIcon() {
  return <SvgIcon name="accounts" />;
}

function LuggageIcon() {
  return <SvgIcon name="luggage" />;
}

function formatDate(value) {
  const date = parseDateValue(value);

  if (!date) {
    return '-';
  }

  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getRelativeDateKey(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return getDateKey(date);
}

function isFlightStatusDisplayWindow(value) {
  const dateKey = getDateKey(value);

  if (!dateKey) {
    return false;
  }

  return dateKey === getRelativeDateKey(0) || dateKey === getRelativeDateKey(1);
}

function normalizeFlightNumber(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

const FLIGHT_STATUS_VALUES = new Set([
  'landed',
  'delayed',
  'in_air',
  'scheduled',
  'cancelled',
  'unknown',
]);
const COPY_NOTICE_DURATION_MS = 1400;

const AIRPORT_CITY_BY_CODE = {
  AMS: 'Amsterdam',
  BCN: 'Barcelona',
  BER: 'Berlin',
  CDG: 'Paris',
  FRA: 'Frankfurt',
  FCO: 'Rome',
  LGW: 'London',
  LHR: 'London',
  LTN: 'London',
  MUC: 'Munich',
  ORY: 'Paris',
  PRG: 'Prague',
  STN: 'London',
  VIE: 'Vienna',
  WAW: 'Warsaw',
};

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeFlightText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseFlightDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatFlightTime(value) {
  const date = value instanceof Date ? value : parseFlightDate(value);

  if (!date) {
    return '';
  }

  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function roundFlightDateUp(date, stepMinutes = 5) {
  const rounded = new Date(date.getTime());
  const minutes = rounded.getUTCMinutes();
  const remainder = minutes % stepMinutes;

  if (remainder) {
    rounded.setUTCMinutes(minutes + stepMinutes - remainder, 0, 0);
  } else {
    rounded.setUTCSeconds(0, 0);
  }

  return rounded;
}

function formatPassengerReadyTime(value) {
  const arrival = parseFlightDate(value);

  if (!arrival) {
    return '';
  }

  return formatFlightTime(roundFlightDateUp(new Date(arrival.getTime() + 30 * 60 * 1000)));
}

function formatDurationUntil(value) {
  const date = parseFlightDate(value);

  if (!date) {
    return '';
  }

  const totalMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);

  if (totalMinutes <= 0) {
    return 'Landing soon';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function normalizeDelayMinutes(value, scheduledArrival, estimatedArrival) {
  const explicitValue = Number.parseInt(String(value ?? '').trim(), 10);

  if (Number.isFinite(explicitValue)) {
    return Math.max(0, explicitValue);
  }

  const scheduled = parseFlightDate(scheduledArrival);
  const estimated = parseFlightDate(estimatedArrival);

  if (!scheduled || !estimated) {
    return 0;
  }

  return Math.max(0, Math.round((estimated.getTime() - scheduled.getTime()) / 60000));
}

function normalizeFlightStatus(value, fallbackFlightNumber) {
  if (!isPlainObject(value)) {
    return null;
  }

  const rawStatus = normalizeFlightText(value.status).toLowerCase();
  const status = FLIGHT_STATUS_VALUES.has(rawStatus) ? rawStatus : 'unknown';
  const route = isPlainObject(value.route) ? value.route : {};

  return {
    status,
    flightNumber: normalizeFlightNumber(value.flightNumber || fallbackFlightNumber),
    route: {
      from: normalizeFlightText(route.from),
      to: normalizeFlightText(route.to),
      fromCode: normalizeFlightText(route.fromCode),
      toCode: normalizeFlightText(route.toCode),
    },
    scheduledArrival: value.scheduledArrival || '',
    estimatedArrival: value.estimatedArrival || '',
    actualArrival: value.actualArrival || '',
    delayMinutes: normalizeDelayMinutes(
      value.delayMinutes,
      value.scheduledArrival,
      value.estimatedArrival,
    ),
    terminal: normalizeFlightText(value.terminal),
    baggageClaim: normalizeFlightText(value.baggageClaim),
    updatedAt: value.updatedAt || '',
  };
}

function cleanupDepartureCity(value) {
  const cleaned = normalizeFlightText(value)
    .replace(/\b(international|airport|letiště|aeroport)\b/gi, '')
    .replace(/\b(vaclav havel|václava havla|schiphol)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned || normalizeFlightText(value);
}

function formatFlightRoute(route) {
  const fromCode = normalizeFlightText(route?.fromCode).toUpperCase();

  if (AIRPORT_CITY_BY_CODE[fromCode]) {
    return AIRPORT_CITY_BY_CODE[fromCode];
  }

  return cleanupDepartureCity(route?.from);
}

function getFlightRouteCode(value) {
  const text = normalizeFlightText(value);
  const bracketCode = text.match(/\(([A-Z]{3})\)/i)?.[1];

  if (bracketCode) {
    return bracketCode.toUpperCase();
  }

  if (/^[A-Z]{3,4}$/i.test(text)) {
    return text.slice(0, 3).toUpperCase();
  }

  const words = text
    .replace(/airport|letiště|aeroport|terminal/gi, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words.slice(0, 3).map(word => word[0]).join('').toUpperCase().slice(0, 3);
  }

  return text.slice(0, 3).toUpperCase();
}

function getFlightStatusBadgeLabel(flightStatus) {
  if (!flightStatus) {
    return '';
  }

  if (flightStatus.status === 'delayed') {
    return flightStatus.delayMinutes
      ? `DELAYED +${flightStatus.delayMinutes} MIN`
      : 'DELAYED';
  }

  if (flightStatus.status === 'in_air') return 'IN AIR';
  if (flightStatus.status === 'landed') return 'LANDED';
  if (flightStatus.status === 'scheduled') return 'SCHEDULED';
  if (flightStatus.status === 'cancelled') return 'CANCELLED';

  return 'UNKNOWN';
}

function getFlightStatusText(flightStatus) {
  const scheduledTime = formatFlightTime(flightStatus.scheduledArrival);
  const estimatedTime = formatFlightTime(flightStatus.estimatedArrival);
  const actualTime = formatFlightTime(flightStatus.actualArrival);
  const updatedTime = formatFlightTime(flightStatus.updatedAt);

  if (flightStatus.status === 'landed') {
    const readyTime = formatPassengerReadyTime(flightStatus.actualArrival);

    return {
      primary: actualTime ? `Landed ${actualTime}` : 'Landed',
      meta: readyTime ? `Passenger ready ~ ${readyTime}` : '',
    };
  }

  if (flightStatus.status === 'delayed') {
    return {
      primary: 'Delayed',
      meta: estimatedTime
        ? `New arrival: ${estimatedTime}`
        : scheduledTime
          ? `Scheduled: ${scheduledTime}`
          : '',
      secondaryMeta: estimatedTime && scheduledTime ? `Scheduled: ${scheduledTime}` : '',
    };
  }

  if (flightStatus.status === 'in_air') {
    const etaTime = estimatedTime || scheduledTime;
    const duration = formatDurationUntil(flightStatus.estimatedArrival || flightStatus.scheduledArrival);

    return {
      primary: etaTime ? `ETA ${etaTime}` : 'In air',
      meta: duration === 'Landing soon' ? duration : duration ? `Landing in ${duration}` : '',
    };
  }

  if (flightStatus.status === 'scheduled') {
    return {
      primary: scheduledTime ? `Scheduled ${scheduledTime}` : 'Scheduled',
      meta: updatedTime ? `Updated ${updatedTime}` : '',
    };
  }

  if (flightStatus.status === 'cancelled') {
    return {
      primary: 'Cancelled',
      meta: scheduledTime ? `Scheduled: ${scheduledTime}` : '',
    };
  }

  return {
    primary: 'Status unknown',
    meta: updatedTime ? `Updated ${updatedTime}` : '',
  };
}

function getFlightStatusExtra(flightStatus) {
  const items = [];

  if (flightStatus.status !== 'delayed') {
    return items;
  }

  if (flightStatus.terminal) {
    items.push(`Terminal: ${flightStatus.terminal}`);
  }

  if (flightStatus.baggageClaim) {
    items.push(`Baggage claim: ${flightStatus.baggageClaim}`);
  }

  return items;
}

function getFlightCardTiming(flightStatus) {
  const scheduledTime = formatFlightTime(flightStatus.scheduledArrival);
  const estimatedTime = formatFlightTime(flightStatus.estimatedArrival);
  const actualTime = formatFlightTime(flightStatus.actualArrival);

  if (flightStatus.status === 'landed') {
    return actualTime ? `Landed ${actualTime}` : 'Landed';
  }

  if (flightStatus.status === 'delayed') {
    const arrivalTime = estimatedTime || scheduledTime;
    return arrivalTime ? `Arrival ${arrivalTime}` : 'Delayed';
  }

  if (flightStatus.status === 'in_air') {
    const arrivalTime = estimatedTime || scheduledTime;
    return arrivalTime ? `ETA ${arrivalTime}` : 'In air';
  }

  if (flightStatus.status === 'scheduled') {
    return scheduledTime ? `Arrival ${scheduledTime}` : 'Scheduled';
  }

  if (flightStatus.status === 'cancelled') {
    return 'Cancelled';
  }

  return '';
}

// Скорочує значення термінала до компактного формату T1, T2 або T3.
function formatFlightTerminal(value) {
  const terminal = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^TERMINAL\s*/i, '')
    .replace(/\s+/g, '');

  if (!terminal) {
    return '';
  }

  return terminal.startsWith('T') ? terminal : `T${terminal}`;
}

function FlightStatusBadge({ flightStatus }) {
  if (!flightStatus) {
    return null;
  }

  return (
    <div className={`orderFlightStatusBadge orderFlightStatusBadge--${flightStatus.status}`}>
      <span className="orderFlightStatusBadgeDot" aria-hidden="true" />
      <span>{getFlightStatusBadgeLabel(flightStatus)}</span>
    </div>
  );
}

function FlightProgress({ route }) {
  const fromCode = getFlightRouteCode(route?.fromCode || route?.from);
  const toCode = getFlightRouteCode(route?.toCode || route?.to);

  return (
    <div className="orderFlightProgress" aria-hidden="true">
      <div className="orderFlightProgressCodes">
        <span>{fromCode || 'DEP'}</span>
        <span>{toCode || 'ARR'}</span>
      </div>
      <div className="orderFlightProgressTrack">
        <span className="orderFlightProgressDot" />
        <span className="orderFlightProgressLine" />
        <span className="orderFlightProgressPlane">
          <FlightIcon />
        </span>
        <span className="orderFlightProgressLine" />
        <span className="orderFlightProgressDot" />
      </div>
    </div>
  );
}

function FlightCopyToast({ visible, label }) {
  if (!visible) {
    return null;
  }

  return (
    <span className="orderFlightCopyToast" role="status" aria-live="polite">
      {label}
    </span>
  );
}

function FlightStatusPanel({ flightStatus, onCopyFlightNumber, copyNoticeVisible, copyNoticeLabel }) {
  if (!flightStatus?.flightNumber) {
    return null;
  }

  const route = formatFlightRoute(flightStatus.route);
  const destinationCode = getFlightRouteCode(flightStatus.route?.toCode || flightStatus.route?.to);
  const routeSummary = [route, destinationCode].filter(Boolean).join(' → ');
  const timing = getFlightCardTiming(flightStatus);
  const terminal = formatFlightTerminal(flightStatus.terminal);

  return (
    <div
      className={`orderFlightPanel orderFlightPanel--${flightStatus.status}`}
      aria-label={`Flight ${flightStatus.flightNumber}${timing ? `: ${timing}` : ''}`}
    >
      <span className="orderFlightPanelNumberWrap">
        <button
          className="orderFlightPanelNumber"
          type="button"
          aria-label={`Copy flight number ${flightStatus.flightNumber}`}
          title={flightStatus.flightNumber}
          onClick={onCopyFlightNumber}
        >
          {flightStatus.flightNumber}
        </button>
        <FlightCopyToast visible={copyNoticeVisible} label={copyNoticeLabel} />
      </span>
      {routeSummary ? <span className="orderFlightPanelRoute">{routeSummary}</span> : null}
      {timing ? <span className="orderFlightPanelTiming">{timing}</span> : null}
      {terminal ? (
        <span className={`orderFlightPanelTerminal orderFlightPanelTerminal--${flightStatus.status}`}>
          {terminal}
        </span>
      ) : null}
    </div>
  );
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}

function getOrderStatusLabel(status, isCompletedByTime, t) {
  if (isCompletedByTime) {
    return t('history.done');
  }

  if (status.bucket === 'today') {
    return t('history.today');
  }

  if (status.bucket === 'planned') {
    return t('history.planned');
  }

  if (status.bucket === 'completed') {
    return t('history.completed');
  }

  return t('history.draft');
}

function HistoryOrderCard({ order, onOpen, referenceDate }) {
  const { t } = useI18n();
  const copyNoticeTimerRef = useRef(null);
  const [copyNoticeVisible, setCopyNoticeVisible] = useState(false);
  const [routeModal, setRouteModal] = useState({
    address: '',
    label: '',
  });
  const status = getHistoryBucket(order);
  const completedByTime = isOrderCompletedByTime(order, referenceDate);
  const statusLabel = getOrderStatusLabel(status, completedByTime, t);
  const customerName = getCustomerName(order);
  const totalPrice = getTotalPrice(order);
  const orderTripTime = getOrderTripTime(order);
  const flightNumber = normalizeFlightNumber(order?.flightNumber || order?.contractData?.flightNumber || '');
  const flightStatus = !completedByTime && flightNumber && isFlightStatusDisplayWindow(orderTripTime)
    ? normalizeFlightStatus(order?.metadata?.flightStatus, flightNumber)
    : null;
  const dateValue = formatDate(orderTripTime || order?.createdAt);
  const timeValue = (() => {
    const date = parseDateValue(orderTripTime || order?.createdAt);

    if (!date) {
      return '-';
    }

    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  })();
  const routeFrom =
    order?.contractData?.trip?.from?.address ||
    order?.trip?.from?.address ||
    order?.trip?.from ||
    '';
  const routeTo =
    order?.contractData?.trip?.to?.address ||
    order?.trip?.to?.address ||
    order?.trip?.to ||
    '';
  const hasRoute = Boolean(routeFrom && routeTo);
  const passengersCount = normalizeCount(order?.contractData?.passengers || order?.passengers);
  const luggageCount = normalizeCount(
    order?.contractData?.trip?.luggageUnits ||
      order?.contractData?.luggageUnits ||
      order?.trip?.luggageUnits,
  );
  const copyNoticeLabel = t('history.flightTextCopied');

  useEffect(() => () => {
    if (copyNoticeTimerRef.current) {
      window.clearTimeout(copyNoticeTimerRef.current);
    }
  }, []);

  function showCopyNotice() {
    if (copyNoticeTimerRef.current) {
      window.clearTimeout(copyNoticeTimerRef.current);
    }

    setCopyNoticeVisible(true);
    copyNoticeTimerRef.current = window.setTimeout(() => {
      setCopyNoticeVisible(false);
      copyNoticeTimerRef.current = null;
    }, COPY_NOTICE_DURATION_MS);
  }

  function handleOpenRouteModal(event, address, label) {
    event.stopPropagation();

    if (!address) {
      return;
    }

    setRouteModal({
      address,
      label,
    });
  }

  function handleCloseRouteModal() {
    setRouteModal({
      address: '',
      label: '',
    });
  }

  function handleOpenDetails() {
    onOpen(order.id);
  }

  async function handleCopyFlightNumber(event) {
    event.stopPropagation();

    if (!flightNumber) {
      return;
    }

    try {
      await copyTextToClipboard(flightNumber);
      showCopyNotice();
    } catch {
      // Clipboard can be blocked by browser permissions; keep the card usable.
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenDetails();
    }
  }

  return (
    <li className={`orderItem orderItem--history orderItem--${status.bucket} ${completedByTime ? 'orderItem--doneByTime' : ''} ${flightStatus ? `orderItem--flight-${flightStatus.status}` : ''}`}>
      <article
        className="orderItemCard orderItemCard-history"
        role="button"
        tabIndex={0}
        onClick={handleOpenDetails}
        onKeyDown={handleKeyDown}
      >
        <div className="orderItemHeader">
          <strong
            className={`orderItemCustomer ${customerName === t('history.customerNotSpecified') ? 'is-placeholder' : ''}`}
          >
            {customerName}
          </strong>
          <div className="orderItemHeaderActions">
            <div className="orderStatusBadgeWrap">
              {completedByTime ? (
                <div className="orderStatusBadgeToday orderStatusBadgeToday--done">
                  <span className="orderStatusBadgeDot" aria-hidden="true" />
                  {statusLabel}
                </div>
              ) : flightStatus ? (
                <FlightStatusBadge flightStatus={flightStatus} />
              ) : (
                <>
                  {status.bucket === 'today' && flightNumber ? (
                    <span className="orderStatusBadgeCopyTarget">
                      <button
                        className="orderStatusBadge"
                        type="button"
                        aria-label={`Copy flight number ${flightNumber}`}
                        title={flightNumber}
                        onClick={handleCopyFlightNumber}
                      >
                        <span className="orderStatusBadgeFlight">
                          <span className="orderStatusBadgeFlightIcon">
                            <FlightIcon />
                          </span>
                          <span className="orderStatusBadgeFlightValue">{flightNumber}</span>
                        </span>
                      </button>
                      <FlightCopyToast visible={copyNoticeVisible} label={copyNoticeLabel} />
                    </span>
                  ) : null}
                  <div className="orderStatusBadgeToday">
                    {status.bucket === 'today' ? <span className="orderStatusBadgeDot" aria-hidden="true" /> : null}
                    {statusLabel}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={`orderItemRouteCard ${flightStatus ? 'orderItemRouteCard--flight' : ''}`}>
          <div className="orderItemRouteTrack" aria-hidden="true">
            <span className="orderItemRouteTrackStart">
              {flightStatus ? <FlightIcon /> : <RouteStartIcon />}
            </span>
            <span className="orderItemRouteTrackLine" />
            <span className="orderItemRouteTrackEnd">
              {flightStatus ? <RouteStartIcon /> : <RouteEndIcon />}
            </span>
          </div>

          {flightStatus ? (
            <FlightStatusPanel
              flightStatus={flightStatus}
              onCopyFlightNumber={handleCopyFlightNumber}
              copyNoticeVisible={copyNoticeVisible}
              copyNoticeLabel={copyNoticeLabel}
            />
          ) : null}

          <div className={`orderItemRoute ${hasRoute ? '' : 'is-placeholder'} ${flightStatus ? 'orderItemRoute--flight' : ''}`}>
            {hasRoute ? (
              <>
                <button
                  className="orderItemRouteLineButton"
                  type="button"
                  onClick={(event) => handleOpenRouteModal(event, routeFrom, t('history.routeFrom'))}
                >
                  <span className="orderItemRouteLineText">
                    <span className="orderItemRouteLineValue">{routeFrom}</span>
                  </span>
                  <span className="orderItemRouteLineArrow" aria-hidden="true">
                    <RouteOpenIcon />
                  </span>
                </button>
                <button
                  className="orderItemRouteLineButton"
                  type="button"
                  onClick={(event) => handleOpenRouteModal(event, routeTo, t('history.routeTo'))}
                >
                  <span className="orderItemRouteLineText">
                    <span className="orderItemRouteLineValue">{routeTo}</span>
                  </span>
                  <span className="orderItemRouteLineArrow" aria-hidden="true">
                    <RouteOpenIcon />
                  </span>
                </button>
              </>
            ) : (
              t('history.routeNotAdded')
            )}
          </div>

          <div className="orderItemRouteStats" aria-label={`${t('contract.passengers')}: ${passengersCount || 0}. ${t('contract.luggageUnits')}: ${luggageCount || 0}.`}>
            <span className="orderItemRouteStat">
              <span className="orderItemRouteStatIcon" aria-hidden="true">
                <PassengersIcon />
              </span>
              <span className="orderItemRouteStatValue">{passengersCount || 0}</span>
            </span>
            <span className="orderItemRouteStat">
              <span className="orderItemRouteStatIcon" aria-hidden="true">
                <LuggageIcon />
              </span>
              <span className="orderItemRouteStatValue">{luggageCount || 0}</span>
            </span>
          </div>
        </div>
        <div className="orderItemMetaRow">
          <span className="orderItemMetaIcon" aria-hidden="true">
            <WalletIcon />
          </span>
          <strong className={`orderItemPrice ${totalPrice === t('history.noPrice') ? 'is-placeholder' : ''}`}>
            {totalPrice}
          </strong>
          <span className="orderItemMetaDivider" aria-hidden="true" />
          <div className="orderItemDateWrap">
            <span className="orderItemDateIcon" aria-hidden="true">
              <SvgIcon name="calendar" />
            </span>
            <span className="orderItemDate">
              <span className="orderItemDateValue">{dateValue}</span>
              <span className="orderItemDateTime">{timeValue}</span>
            </span>
          </div>
          <button className="orderItemArrow" type="button" onClick={handleOpenDetails} aria-label={t('history.openDetails')}>
            <SvgIcon name="chevron-right" />
          </button>
        </div>
      </article>

      {routeModal.address ? (
        <HistoryRouteModal
          address={routeModal.address}
          label={routeModal.label}
          onClose={handleCloseRouteModal}
          t={t}
        />
      ) : null}
    </li>
  );
}

export { HistoryOrderCard };
