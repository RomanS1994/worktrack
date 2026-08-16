import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { resolveErrorMessage } from '@shared/app/utils/errorMessages.js';
import { hasPlatinumTeamAccess } from '@shared/features/auth/authAccess.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { useGetTeamQuery } from '@shared/features/auth/authApi.js';
import {
  useCreateOrderOfferMutation,
  useDeleteOrderMutation,
  useGetOrderQuery,
  useSearchDispatchDriversQuery,
} from '../../features/orders/ordersApi.js';
import {
  formatDateTime,
  getHistoryBucket,
  getOrderTripTime,
  getTotalPrice,
  isOrderCompletedByTime,
} from '../HistoryPage/historyUtils.js';
import { parseDateValue } from '../shared/dateUtils.js';
import './OrderDispatchPage.css';

function getLocation(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.address || value.name || value.label || '-';
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatOrderDate(value) {
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

function formatOrderTime(value) {
  const date = parseDateValue(value);

  if (!date) {
    return '-';
  }

  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getOrderSummary(order, t) {
  const contractData = order?.contractData || {};
  const customer = contractData.customer || order?.customer || {};
  const trip = contractData.trip || order?.trip || {};
  const tripTime = getOrderTripTime(order);

  return {
    orderNumber: order?.orderNumber || order?.id || '-',
    customerName: customer.name || t('history.guest'),
    from: getLocation(trip.from),
    to: getLocation(trip.to),
    tripDate: formatOrderDate(tripTime || order?.createdAt),
    tripTime: formatOrderTime(tripTime || order?.createdAt),
    fullTripTime: formatDateTime(tripTime || order?.createdAt),
    totalPrice: getTotalPrice(order),
    passengers: normalizeCount(contractData.passengers || order?.passengers),
    luggage: normalizeCount(trip.luggageUnits || contractData.luggageUnits || order?.luggageUnits),
    createdBy: order?.createdBy?.name || order?.createdBy?.email || '-',
  };
}

function getDispatchStatus(order, t) {
  if (isOrderCompletedByTime(order)) {
    return {
      label: t('history.done'),
      tone: 'done',
    };
  }

  const status = getHistoryBucket(order);

  if (status.bucket === 'today') {
    return {
      label: t('history.today'),
      tone: 'today',
    };
  }

  if (status.bucket === 'planned') {
    return {
      label: t('history.planned'),
      tone: 'planned',
    };
  }

  if (status.bucket === 'completed') {
    return {
      label: t('history.completed'),
      tone: 'completed',
    };
  }

  return {
    label: t('history.draft'),
    tone: 'draft',
  };
}

function OrderDispatchShell({ backTo, children, subtitle, title }) {
  return (
    <section className="orderDispatchPage pageStack">
      <header className="orderDispatchPage-header">
        <BackButton to={backTo} />
        <div className="appTitleBlock">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function OrderDispatchSummary({ order, t }) {
  const summary = getOrderSummary(order, t);
  const status = getDispatchStatus(order, t);

  return (
    <section className="orderDispatchSummary">
      <div className="orderDispatchSummary-header">
        <div className="orderDispatchSummary-identity">
          <strong className="orderDispatchSummary-customer">{summary.customerName}</strong>
        </div>
        <div className={`orderDispatchSummary-status orderDispatchSummary-status--${status.tone}`}>
          <span className="orderDispatchSummary-statusDot" aria-hidden="true" />
          {status.label}
        </div>
      </div>

      <div className="orderDispatchSummary-routeCard">
        <div className="orderDispatchSummary-routeTrack" aria-hidden="true">
          <span className="orderDispatchSummary-routeIcon">
            <SvgIcon name="today" />
          </span>
          <span className="orderDispatchSummary-routeLine" />
          <span className="orderDispatchSummary-routeIcon orderDispatchSummary-routeIcon--end">
            <SvgIcon name="completed" />
          </span>
        </div>

        <div className="orderDispatchSummary-route">
          <div className="orderDispatchSummary-routePoint">
            <strong>{summary.from}</strong>
          </div>
          <div className="orderDispatchSummary-routePoint">
            <strong>{summary.to}</strong>
          </div>
        </div>

        <div
          className="orderDispatchSummary-stats"
          aria-label={`${t('contract.passengers')}: ${summary.passengers}. ${t('contract.luggageUnits')}: ${summary.luggage}.`}
        >
          <span className="orderDispatchSummary-stat">
            <span className="orderDispatchSummary-statIcon" aria-hidden="true">
              <SvgIcon name="accounts" />
            </span>
            <span>{summary.passengers}</span>
          </span>
          <span className="orderDispatchSummary-stat">
            <span className="orderDispatchSummary-statIcon" aria-hidden="true">
              <SvgIcon name="luggage" />
            </span>
            <span>{summary.luggage}</span>
          </span>
        </div>
      </div>

      <div className="orderDispatchSummary-meta">
        <span className="orderDispatchSummary-metaIcon" aria-hidden="true">
          <SvgIcon name="wallet" />
        </span>
        <strong className="orderDispatchSummary-price">{summary.totalPrice}</strong>
        <span className="orderDispatchSummary-divider" aria-hidden="true" />
        <div className="orderDispatchSummary-dateWrap" title={summary.fullTripTime}>
          <span className="orderDispatchSummary-dateIcon" aria-hidden="true">
            <SvgIcon name="calendar" />
          </span>
          <span className="orderDispatchSummary-date">
            <span>{summary.tripDate}</span>
            <strong>{summary.tripTime}</strong>
          </span>
        </div>
      </div>

      <div className="orderDispatchSummary-createdBy">
        <span>{t('orderDispatch.createdBy')}</span>
        <strong>{summary.createdBy}</strong>
      </div>
    </section>
  );
}

function Feedback({ error, isLoading, loadingLabel, message }) {
  if (isLoading) {
    return <RequestLoadingState className="orderDispatchState" label={loadingLabel} />;
  }

  return (
    <>
      {message ? <p className="orderDispatchMessage">{message}</p> : null}
      {error ? <p className="orderDispatchError">{error}</p> : null}
    </>
  );
}

function DispatchAction({ children, disabled = false, icon, onClick, to, tone = 'default' }) {
  const className = `orderDispatchAction orderDispatchAction--${tone}${disabled ? ' is-disabled' : ''}`;
  const content = (
    <>
      <span className="orderDispatchAction-icon" aria-hidden="true">
        <SvgIcon name={icon} />
      </span>
      <span className="orderDispatchAction-copy">{children}</span>
      <SvgIcon className="orderDispatchAction-chevron" name="chevron-right" />
    </>
  );

  if (to && !disabled) {
    return (
      <Link className={className} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

function useDispatchOrder(orderId) {
  const { t } = useI18n();
  const { data, isError, isLoading } = useGetOrderQuery(orderId, {
    skip: !orderId,
  });
  const order = data?.order || data || {};

  return {
    isError,
    isLoading,
    order,
    t,
  };
}

export function OrderDispatchPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector(selectUser);
  const canUseTeams = hasPlatinumTeamAccess(currentUser);
  const { isError, isLoading, order, t } = useDispatchOrder(orderId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createOrderOffer, { isLoading: isSending }] = useCreateOrderOfferMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();

  async function sendToAllDrivers() {
    setMessage('');
    setError('');

    try {
      await createOrderOffer({
        orderId,
        payload: {
          targetType: 'all',
        },
      }).unwrap();
      setMessage(t('orderDispatch.sentAll'));
    } catch (sendError) {
      setError(resolveErrorMessage(sendError, t('orderDispatch.failedToSend')));
    }
  }

  async function deletePermanently() {
    setMessage('');
    setError('');

    if (!window.confirm(t('contract.deleteOrderConfirm'))) {
      return;
    }

    try {
      await deleteOrder(orderId).unwrap();
      navigate('/history');
    } catch (deleteError) {
      setError(resolveErrorMessage(deleteError, t('contract.failedToDeleteOrder')));
    }
  }

  return (
    <OrderDispatchShell
      backTo="/history"
      title={t('orderDispatch.title')}
      subtitle={t('orderDispatch.subtitle')}
    >
      <Feedback
        error={isError ? t('contract.failedLoadOrder') : error}
        isLoading={isLoading}
        loadingLabel={t('contract.loadingOrder')}
        message={message}
      />

      {!isLoading && !isError ? (
        <>
          <OrderDispatchSummary order={order} t={t} />

          <div className="orderDispatchActions">
            <DispatchAction icon="accounts" onClick={sendToAllDrivers} disabled={isSending || isDeleting}>
              <strong>{t('orderDispatch.sendAll')}</strong>
              <span>{t('orderDispatch.sendAllCopy')}</span>
            </DispatchAction>

            <DispatchAction
              icon="calendar"
              to={`/orders/${orderId}/dispatch/team`}
              disabled={!canUseTeams || isSending || isDeleting}
            >
              <strong>{t('orderDispatch.sendTeam')}</strong>
              <span>{canUseTeams ? t('orderDispatch.sendTeamCopy') : t('orderDispatch.platinumOnly')}</span>
            </DispatchAction>

            <DispatchAction
              icon="search"
              to={`/orders/${orderId}/dispatch/driver`}
              disabled={isSending || isDeleting}
            >
              <strong>{t('orderDispatch.sendDriver')}</strong>
              <span>{t('orderDispatch.sendDriverCopy')}</span>
            </DispatchAction>

            <DispatchAction
              icon="trash"
              tone="danger"
              onClick={deletePermanently}
              disabled={isSending || isDeleting}
            >
              <strong>{t('orderDispatch.deleteOrder')}</strong>
              <span>{isDeleting ? t('common.deleting') : t('orderDispatch.deleteOrderCopy')}</span>
            </DispatchAction>
          </div>
        </>
      ) : null}
    </OrderDispatchShell>
  );
}

export function OrderDispatchTeamPage() {
  const { orderId } = useParams();
  const { isError, isLoading, order, t } = useDispatchOrder(orderId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [createOrderOffer, { isLoading: isSending }] = useCreateOrderOfferMutation();
  const { data: teamData, isFetching: isTeamsLoading, isError: isTeamsError } = useGetTeamQuery();
  const teams = teamData?.teams || [];

  async function sendToTeam(team) {
    setSelectedTeamId(team.id);
    setMessage('');
    setError('');

    try {
      await createOrderOffer({
        orderId,
        payload: {
          targetType: 'team',
          targetTeamId: team.id,
        },
      }).unwrap();
      setMessage(t('orderDispatch.sentTeam', { team: team.name }));
    } catch (sendError) {
      setError(resolveErrorMessage(sendError, t('orderDispatch.failedToSend')));
    }
  }

  return (
    <OrderDispatchShell
      backTo={`/orders/${orderId}/dispatch`}
      title={t('orderDispatch.teamTitle')}
      subtitle={t('orderDispatch.teamSubtitle')}
    >
      <Feedback
        error={isError ? t('contract.failedLoadOrder') : error}
        isLoading={isLoading}
        loadingLabel={t('contract.loadingOrder')}
        message={message}
      />

      {!isLoading && !isError ? <OrderDispatchSummary order={order} t={t} /> : null}

      {isTeamsLoading ? (
        <RequestLoadingState className="orderDispatchState" label={t('settings.team.loading')} />
      ) : null}
      {isTeamsError ? <p className="orderDispatchError">{t('settings.team.failedLoad')}</p> : null}

      {!isTeamsLoading && !isTeamsError && teams.length ? (
        <ul className="orderDispatchList">
          {teams.map(team => {
            const driversCount = Array.isArray(team.driverIds) ? team.driverIds.length : 0;
            const isSelected = selectedTeamId === team.id;

            return (
              <li key={team.id}>
                <button
                  className="orderDispatchListButton"
                  type="button"
                  onClick={() => sendToTeam(team)}
                  disabled={isSending || driversCount === 0}
                >
                  <span className="orderDispatchListIcon" aria-hidden="true">
                    <SvgIcon name="accounts" />
                  </span>
                  <span className="orderDispatchListCopy">
                    <strong>{team.name}</strong>
                    <span>{t('settings.team.teamDriversCount', { count: driversCount })}</span>
                  </span>
                  {isSending && isSelected ? (
                    <RequestLoader inline size="sm" label={t('common.transferring')} />
                  ) : (
                    <SvgIcon name="chevron-right" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!isTeamsLoading && !isTeamsError && !teams.length ? (
        <p className="orderDispatchState">{t('settings.team.noTeams')}</p>
      ) : null}
    </OrderDispatchShell>
  );
}

export function OrderDispatchDriverPage() {
  const { orderId } = useParams();
  const { isError, isLoading, order, t } = useDispatchOrder(orderId);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [createOrderOffer, { isLoading: isSending }] = useCreateOrderOfferMutation();
  const { data, isFetching: isDriversLoading, isError: isDriversError } =
    useSearchDispatchDriversQuery({
      search,
    });
  const drivers = data?.drivers || [];
  const hasSearch = Boolean(search.trim());
  const visibleDrivers = useMemo(() => drivers, [drivers]);

  async function sendToDriver(driver) {
    setSelectedDriverId(driver.id);
    setMessage('');
    setError('');

    try {
      await createOrderOffer({
        orderId,
        payload: {
          targetType: 'driver',
          targetUserId: driver.id,
        },
      }).unwrap();
      setMessage(t('orderDispatch.sentDriver', { name: driver.name || driver.email }));
    } catch (sendError) {
      setError(resolveErrorMessage(sendError, t('orderDispatch.failedToSend')));
    }
  }

  return (
    <OrderDispatchShell
      backTo={`/orders/${orderId}/dispatch`}
      title={t('orderDispatch.driverTitle')}
      subtitle={t('orderDispatch.driverSubtitle')}
    >
      <Feedback
        error={isError ? t('contract.failedLoadOrder') : error}
        isLoading={isLoading}
        loadingLabel={t('contract.loadingOrder')}
        message={message}
      />

      {!isLoading && !isError ? <OrderDispatchSummary order={order} t={t} /> : null}

      <label className="orderDispatchSearch">
        <span>{t('common.search')}</span>
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('contract.searchByNameOrEmail')}
        />
      </label>

      {isDriversLoading ? (
        <RequestLoadingState className="orderDispatchState" label={t('contract.loadingDrivers')} />
      ) : null}
      {isDriversError ? <p className="orderDispatchError">{t('contract.noDrivers')}</p> : null}

      {!isDriversLoading && !isDriversError && visibleDrivers.length ? (
        <ul className="orderDispatchList">
          {visibleDrivers.map(driver => {
            const isSelected = selectedDriverId === driver.id;

            return (
              <li key={driver.id}>
                <button
                  className="orderDispatchListButton"
                  type="button"
                  onClick={() => sendToDriver(driver)}
                  disabled={isSending}
                >
                  <span className="orderDispatchListIcon" aria-hidden="true">
                    <SvgIcon name="user" />
                  </span>
                  <span className="orderDispatchListCopy">
                    <strong>{driver.name || t('common.noName')}</strong>
                    <span>{driver.email || driver.phone || '-'}</span>
                  </span>
                  {isSending && isSelected ? (
                    <RequestLoader inline size="sm" label={t('common.transferring')} />
                  ) : (
                    <SvgIcon name="chevron-right" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!isDriversLoading && !isDriversError && !visibleDrivers.length ? (
        <p className="orderDispatchState">
          {hasSearch ? t('contract.noDrivers') : t('orderDispatch.noDrivers')}
        </p>
      ) : null}
    </OrderDispatchShell>
  );
}
