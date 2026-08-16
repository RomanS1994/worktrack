import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { formatDateTime } from '@shared/app/utils/dateFormat.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetAdminOrderQuery,
  useRestoreOrderMutation,
} from '@shared/features/admin/adminApi.js';
import './AdminOrderDetailsPage.css';

function getFieldValue(value) {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return value.address || value.name || value.label || '-';
  }

  return String(value);
}

export function AdminOrderDetailsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [restoreError, setRestoreError] = useState('');
  const [searchParams] = useSearchParams();
  const { orderId } = useParams();
  const state = searchParams.get('state') === 'deleted' ? 'deleted' : 'active';
  const [restoreOrder, { isLoading: isRestoring }] = useRestoreOrderMutation();
  const { data, isLoading, isError, error } = useGetAdminOrderQuery(
    { orderId, state },
    {
      skip: !orderId,
    }
  );
  const order = data?.order || data || {};
  const createdAt = formatDateTime(order.createdAt, 'uk');
  const updatedAt = formatDateTime(order.updatedAt, 'uk');
  const isDeleted = state === 'deleted' || Boolean(order.deletedAt);
  const backToUserOrders = order.user?.id
    ? `/admin/orders/users/${order.user.id}?state=${state}`
    : '/admin/orders';

  if (isLoading) {
    return (
      <section className="adminOrderDetailsPage">
        <RequestLoadingState className="adminOrderDetailsPage-state" label={t('common.loadingOrders')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminOrderDetailsPage">
        <p className="adminOrderDetailsPage-state">{getApiErrorMessage(error, t('admin.failedOrder'))}</p>
      </section>
    );
  }

  return (
    <section className="adminOrderDetailsPage">
      <div className="adminOrderDetailsPage-header">
        <BackButton to={backToUserOrders} />

        {isDeleted ? (
          <span className="adminOrderDetailsPage-badge">{t('common.deleted')}</span>
        ) : null}

        <div className="adminOrderDetailsPage-summary">
          <div className="adminOrderDetailsPage-summaryItem">
            <span className="adminOrderDetailsPage-label">{t('admin.orders')}</span>
            <strong className="adminOrderDetailsPage-value">{order.orderNumber || '-'}</strong>
          </div>
          <div className="adminOrderDetailsPage-summaryItem">
            <span className="adminOrderDetailsPage-label">{t('contract.priceLabel')}</span>
            <strong className="adminOrderDetailsPage-value">{order.totalPrice || '-'}</strong>
          </div>
        </div>
      </div>

      <div className="adminOrderDetailsPage-grid">
        <section className="adminOrderDetailsPage-card">
          <h3 className="adminOrderDetailsPage-cardTitle">{t('contract.customer')}</h3>
          <p className="adminOrderDetailsPage-cardValue">{getFieldValue(order.customer?.name)}</p>
          <p className="adminOrderDetailsPage-cardMeta">{getFieldValue(order.customer?.email)}</p>
        </section>

        <section className="adminOrderDetailsPage-card">
          <h3 className="adminOrderDetailsPage-cardTitle">{t('contract.tripInfo')}</h3>
          <p className="adminOrderDetailsPage-cardValue">
            {getFieldValue(order.trip?.from)} → {getFieldValue(order.trip?.to)}
          </p>
          <p className="adminOrderDetailsPage-cardMeta">
            {getFieldValue(order.trip?.time)}
          </p>
        </section>

        <section className="adminOrderDetailsPage-card">
          <h3 className="adminOrderDetailsPage-cardTitle">{t('common.created')}</h3>
          <p className="adminOrderDetailsPage-cardValue">{createdAt}</p>
          <p className="adminOrderDetailsPage-cardMeta">{updatedAt}</p>
        </section>
      </div>

      {isDeleted ? (
        <section className="adminOrderDetailsPage-restorePanel">
          <div className="adminOrderDetailsPage-restoreCopy">
            <h3 className="adminOrderDetailsPage-panelTitle">{t('adminOrderDetails.restoreTitle')}</h3>
            <p className="adminOrderDetailsPage-restoreText">
              {t('adminOrderDetails.restoreCopy')}
            </p>
            {restoreError ? <p className="adminOrderDetailsPage-restoreError">{restoreError}</p> : null}
          </div>
          <button
            className="adminOrderDetailsPage-restoreButton"
            type="button"
            onClick={async () => {
              setRestoreError('');

              try {
                await restoreOrder({ orderId }).unwrap();
                navigate(order.user?.id ? `/admin/orders/users/${order.user.id}?state=active` : '/admin/orders');
              } catch (error) {
                setRestoreError(getApiErrorMessage(error, t('adminOrderDetails.failedRestoreOrder')));
              }
            }}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <RequestLoader inline size="sm" label={t('common.restoring')} />
            ) : (
              t('common.restore')
            )}
          </button>
        </section>
      ) : null}

      <section className="adminOrderDetailsPage-panel">
        <h3 className="adminOrderDetailsPage-panelTitle">{t('admin.orderDetails')}</h3>
        <pre className="adminOrderDetailsPage-json">{JSON.stringify(order.metadata || {}, null, 2)}</pre>
      </section>
    </section>
  );
}
