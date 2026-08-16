import { useNavigate } from 'react-router-dom';

import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetAdminUsersQuery } from '@shared/features/admin/adminApi.js';
import { AdminUsersList } from '../../features/admin/components/AdminUsersList/AdminUsersList.jsx';
import './AdminOrdersPage.css';

export function AdminOrdersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetAdminUsersQuery();
  const users = data?.users || [];

  return (
    <section className="adminOrdersPage">
      <div className="adminOrdersPage-header">
        <h2 className="adminOrdersPage-title">{t('adminOrders.title')}</h2>
        <p className="adminOrdersPage-copy">{t('adminOrders.copy')}</p>
      </div>

      <section className="adminOrdersPage-users">
        <div className="adminOrdersPage-usersHeader">
          <h3 className="adminOrdersPage-usersTitle">{t('adminDashboard.users')}</h3>
        </div>

        {isLoading ? (
          <RequestLoadingState className="adminOrdersPage-state" label={t('common.loadingUsers')} />
        ) : null}
        {isError ? <p className="adminOrdersPage-state">{t('common.failedToLoad')}</p> : null}
        {!isLoading && !isError && users.length ? (
          <AdminUsersList users={users} onOpenUser={userId => navigate(`/admin/orders/users/${userId}`)} />
        ) : null}
      </section>
    </section>
  );
}
