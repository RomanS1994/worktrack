import { useState } from 'react';

import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { resolveErrorMessage } from '@shared/app/utils/errorMessages.js';
import { WorkspaceTabs } from '../../components/WorkspaceTabs/WorkspaceTabs.jsx';
import {
  useAcceptOrderOfferMutation,
  useGetAvailableOrdersQuery,
  useSkipOrderOfferMutation,
} from '../../features/orders/ordersApi.js';
import { formatDateTime, getOrderTripTime } from '../HistoryPage/historyUtils.js';
import './AvailableOrdersPage.css';

function getLocation(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.address || value.name || value.label || '-';
}

function getOfferOrderSummary(offer, t) {
  const order = offer?.order || {};
  const contractData = order.contractData || {};
  const customer = contractData.customer || order.customer || {};
  const trip = contractData.trip || order.trip || {};

  return {
    orderNumber: order.orderNumber || order.id || '-',
    customerName: customer.name || t('history.guest'),
    from: getLocation(trip.from),
    to: getLocation(trip.to),
    tripTime: formatDateTime(getOrderTripTime(order)),
    totalPrice: order.totalPrice || contractData.totalPrice || '-',
    sender: offer.fromUser?.name || offer.fromUser?.email || '-',
    createdBy: order.createdBy?.name || order.createdBy?.email || offer.createdByUser?.name || '-',
  };
}

function AvailableOrderCard({
  actionState,
  isAccepting,
  isSkipping,
  offer,
  onAccept,
  onSkip,
  t,
}) {
  const summary = getOfferOrderSummary(offer, t);
  const isCurrentAccept = actionState.offerId === offer.id && actionState.action === 'accept';
  const isCurrentSkip = actionState.offerId === offer.id && actionState.action === 'skip';
  const isBusy = isAccepting || isSkipping;

  return (
    <article className="availableOrderCard">
      <header className="availableOrderCard-header">
        <span className="availableOrderCard-icon" aria-hidden="true">
          <SvgIcon name="calendar" />
        </span>
        <div className="availableOrderCard-titleBlock">
          <span>{summary.orderNumber}</span>
          <strong>{summary.customerName}</strong>
        </div>
      </header>

      <div className="availableOrderRoute">
        <div>
          <span>{t('contract.from')}</span>
          <strong>{summary.from}</strong>
        </div>
        <SvgIcon name="route" />
        <div>
          <span>{t('contract.to')}</span>
          <strong>{summary.to}</strong>
        </div>
      </div>

      <dl className="availableOrderMeta">
        <div>
          <dt>{t('contract.tripTime')}</dt>
          <dd>{summary.tripTime}</dd>
        </div>
        <div>
          <dt>{t('contract.amountDue')}</dt>
          <dd>{summary.totalPrice}</dd>
        </div>
        <div>
          <dt>{t('availableOrders.sentBy')}</dt>
          <dd>{summary.sender}</dd>
        </div>
        <div>
          <dt>{t('orderDispatch.createdBy')}</dt>
          <dd>{summary.createdBy}</dd>
        </div>
      </dl>

      <div className="availableOrderActions">
        <button
          className="availableOrderButton availableOrderButton--accept"
          type="button"
          onClick={() => onAccept(offer)}
          disabled={isBusy}
        >
          {isCurrentAccept ? (
            <RequestLoader inline size="sm" label={t('availableOrders.accepting')} />
          ) : (
            <>
              <SvgIcon name="check-circle" />
              <span>{t('availableOrders.accept')}</span>
            </>
          )}
        </button>
        <button
          className="availableOrderButton availableOrderButton--skip"
          type="button"
          onClick={() => onSkip(offer)}
          disabled={isBusy}
        >
          {isCurrentSkip ? (
            <RequestLoader inline size="sm" label={t('availableOrders.skipping')} />
          ) : (
            <>
              <SvgIcon name="clear" />
              <span>{t('availableOrders.skip')}</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export function AvailableOrdersPage() {
  const { t } = useI18n();
  const { data, isError, isLoading } = useGetAvailableOrdersQuery();
  const [acceptOffer, { isLoading: isAccepting }] = useAcceptOrderOfferMutation();
  const [skipOffer, { isLoading: isSkipping }] = useSkipOrderOfferMutation();
  const [actionState, setActionState] = useState({ offerId: '', action: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const offers = data?.offers || [];

  async function acceptAvailableOrder(offer) {
    setMessage('');
    setError('');
    setActionState({ offerId: offer.id, action: 'accept' });

    try {
      await acceptOffer({
        orderId: offer.orderId,
        offerId: offer.id,
      }).unwrap();
      setMessage(t('availableOrders.accepted'));
    } catch (acceptError) {
      setError(resolveErrorMessage(acceptError, t('availableOrders.failedAccept')));
    } finally {
      setActionState({ offerId: '', action: '' });
    }
  }

  async function skipAvailableOrder(offer) {
    setMessage('');
    setError('');
    setActionState({ offerId: offer.id, action: 'skip' });

    try {
      await skipOffer({
        orderId: offer.orderId,
        offerId: offer.id,
      }).unwrap();
      setMessage(t('availableOrders.skipped'));
    } catch (skipError) {
      setError(resolveErrorMessage(skipError, t('availableOrders.failedSkip')));
    } finally {
      setActionState({ offerId: '', action: '' });
    }
  }

  return (
    <section className="availableOrdersPage pageStack">
      <WorkspaceTabs />

      {message ? <p className="availableOrdersPage-message">{message}</p> : null}
      {error ? <p className="availableOrdersPage-error">{error}</p> : null}

      {isLoading ? (
        <RequestLoadingState className="availableOrdersPage-empty" label={t('common.loadingOrders')} />
      ) : null}
      {isError ? <p className="availableOrdersPage-error">{t('common.failedOrder')}</p> : null}

      {!isLoading && !isError && !offers.length ? (
        <div className="screenCard">
          <div className="availableOrdersPage-empty">
            <p>{t('availableOrders.empty')}</p>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && offers.length ? (
        <div className="availableOrdersList">
          {offers.map(offer => (
            <AvailableOrderCard
              key={offer.id}
              actionState={actionState}
              isAccepting={isAccepting}
              isSkipping={isSkipping}
              offer={offer}
              onAccept={acceptAvailableOrder}
              onSkip={skipAvailableOrder}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
