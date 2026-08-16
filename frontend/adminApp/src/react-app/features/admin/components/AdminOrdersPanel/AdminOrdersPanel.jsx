import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetAdminOrdersQuery } from '@shared/features/admin/adminApi.js';
import './AdminOrdersPanel.css';

export function AdminOrdersPanel({
  userId = '',
  state = 'active',
  activeCount = 0,
  deletedCount = 0,
  onOpenOrder,
}) {
  const { t } = useI18n();
  const { data, isLoading, isError } = useGetAdminOrdersQuery(
    userId ? { userId, state } : undefined,
  );
  const orders = data?.orders || [];
  const isEmpty = !isLoading && !isError && !orders.length;

  return (
    <section className="adminOrdersPanel">
      <div className="adminOrdersPanel-header">
        <h3 className="adminOrdersPanel-title">{t('admin.orders')}</h3>
        {userId ? (
          <span className="adminOrdersPanel-pill">
            {state === 'deleted' ? t('common.deleted') : t('common.active')}
          </span>
        ) : null}
      </div>
      {userId ? (
        <div className="adminOrdersPanel-counts" aria-label={t('adminOrders.orderCounts')}>
          <span className="adminOrdersPanel-count">
            {t('common.active')}: {activeCount}
          </span>
          <span className="adminOrdersPanel-count">
            {t('common.deleted')}: {deletedCount}
          </span>
        </div>
      ) : null}
      {isLoading ? (
        <RequestLoadingState className="adminOrdersPanel-state" label={t('common.loadingOrders')} />
      ) : isError ? (
        <p className="adminOrdersPanel-state">{t('admin.failedOrders')}</p>
      ) : isEmpty ? (
        <p className="adminOrdersPanel-state">{t('admin.noOrders')}</p>
      ) : (
        <ul className="adminOrdersPanel-list">
          {orders.map(order => (
            <li className="adminOrdersPanel-item" key={order.id}>
              <button
                className="adminOrdersPanel-button"
                type="button"
                onClick={() => onOpenOrder?.(order.id)}
              >
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">{t('admin.orders')}</span>
                  <span className="adminOrdersPanel-value">{order.orderNumber || '-'}</span>
                </div>
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">{t('common.status')}</span>
                  <span className="adminOrdersPanel-value">{order.status || '-'}</span>
                </div>
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">{t('contract.priceLabel')}</span>
                  <span className="adminOrdersPanel-value">{order.totalPrice || '-'}</span>
                </div>
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">{t('common.name')}</span>
                  <span className="adminOrdersPanel-value">{order.user?.name || '-'}</span>
                </div>
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">{t('contract.customer')}</span>
                  <span className="adminOrdersPanel-value">{order.customer?.name || '-'}</span>
                </div>
                <div className="adminOrdersPanel-row">
                  <span className="adminOrdersPanel-label">
                    {state === 'deleted' ? t('common.deleted') : t('common.created')}
                  </span>
                  <span className="adminOrdersPanel-value">
                    {state === 'deleted' ? order.deletedAt || '-' : order.createdAt || '-'}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
