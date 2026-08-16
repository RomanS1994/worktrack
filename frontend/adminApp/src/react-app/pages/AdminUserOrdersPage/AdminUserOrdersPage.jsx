import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetAdminOrdersQuery,
  useGetAdminUserQuery,
} from '@shared/features/admin/adminApi.js';
import { AdminOrdersPanel } from '../../features/admin/components/AdminOrdersPanel/AdminOrdersPanel.jsx';
import './AdminUserOrdersPage.css';

export function AdminUserOrdersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId } = useParams();
  const tab = searchParams.get('state') === 'deleted' ? 'deleted' : 'active';
  const { data, isLoading, isError, error } = useGetAdminUserQuery(userId, {
    skip: !userId,
  });
  const { data: activeOrdersData, isLoading: isActiveOrdersLoading } = useGetAdminOrdersQuery(
    { userId, state: 'active' },
    { skip: !userId },
  );
  const { data: deletedOrdersData, isLoading: isDeletedOrdersLoading } = useGetAdminOrdersQuery(
    { userId, state: 'deleted' },
    { skip: !userId },
  );
  const user = data?.user || data || {};
  const activeOrdersCount = activeOrdersData?.summary?.all || 0;
  const deletedOrdersCount = deletedOrdersData?.summary?.all || 0;

  if (isLoading) {
    return (
      <section className="adminUserOrdersPage">
        <RequestLoadingState className="adminUserOrdersPage-state" label={t('common.loadingUsers')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminUserOrdersPage">
        <p className="adminUserOrdersPage-state">{getApiErrorMessage(error, t('admin.failedUser'))}</p>
      </section>
    );
  }

  return (
    <section className="adminUserOrdersPage">
      <div className="adminUserOrdersPage-header">
        <BackButton to="/admin/orders" />

        <div className="adminUserOrdersPage-copyBlock">
          <h2 className="adminUserOrdersPage-title">{t('adminOrders.userOrders')}</h2>
          <p className="adminUserOrdersPage-copy">{t('adminOrders.userOrdersCopy')}</p>
        </div>
      </div>

      <div
        className="adminUserOrdersPage-tabs"
        role="tablist"
        aria-label={t('common.orderStatusTabs')}
      >
        <button
          className={`adminUserOrdersPage-tab${tab === 'active' ? ' adminUserOrdersPage-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          onClick={() => setSearchParams({ state: 'active' })}
        >
          {t('common.active')}
          <span className="adminUserOrdersPage-tabCount">
            {isActiveOrdersLoading ? <RequestLoader inline size="sm" label={t('common.loading')} /> : activeOrdersCount}
          </span>
        </button>
        <button
          className={`adminUserOrdersPage-tab${tab === 'deleted' ? ' adminUserOrdersPage-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'deleted'}
          onClick={() => setSearchParams({ state: 'deleted' })}
        >
          {t('common.deleted')}
          <span className="adminUserOrdersPage-tabCount">
            {isDeletedOrdersLoading ? <RequestLoader inline size="sm" label={t('common.loading')} /> : deletedOrdersCount}
          </span>
        </button>
      </div>

      <section className="adminUserOrdersPage-user">
        <div className="adminUserOrdersPage-userMain">
          <strong className="adminUserOrdersPage-userName">{user.name || t('common.noName')}</strong>
          <span className="adminUserOrdersPage-userEmail">{user.email || '-'}</span>
        </div>
        <div className="adminUserOrdersPage-userMeta">
          <span className="adminUserOrdersPage-userMetaItem">{user.role || '-'}</span>
          <span className="adminUserOrdersPage-userMetaItem">{user.subscription?.status || '-'}</span>
        </div>
      </section>

      <AdminOrdersPanel
        userId={userId}
        state={tab}
        activeCount={activeOrdersCount}
        deletedCount={deletedOrdersCount}
        onOpenOrder={orderId => navigate(`/admin/orders/view/${orderId}?state=${tab}`)}
      />
    </section>
  );
}
