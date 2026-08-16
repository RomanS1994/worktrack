import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetAdminUsersQuery,
  useGetAdminOrdersQuery,
} from '@shared/features/admin/adminApi.js';
import './AdminPage.css';

export function AdminPage() {
  const { t } = useI18n();
  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
    error: usersError,
  } = useGetAdminUsersQuery();
  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    error: ordersError,
  } = useGetAdminOrdersQuery({ limit: 1 });

  const users = usersData?.users || [];
  const orders = ordersData?.orders || [];
  const ordersTotal = ordersData?.summary?.all ?? orders.length;

  function getCount(value, isLoading) {
    if (isLoading) {
      return <RequestLoader inline size="sm" label={t('common.loading')} />;
    }

    return String(value);
  }

  function getMetricState(isError, error, fallback) {
    if (isError) {
      return getApiErrorMessage(error, fallback);
    }

    return fallback;
  }

  const metrics = [
    {
      tone: 'blue',
      label: t('adminDashboard.users'),
      value: getCount(users.length, isUsersLoading),
      copy: t('adminAccounts.copy'),
      state: isUsersError ? getMetricState(isUsersError, usersError, t('common.failedToLoad')) : '',
      to: '/admin/accounts',
    },
    {
      tone: 'amber',
      label: t('adminDashboard.orders'),
      value: getCount(ordersTotal, isOrdersLoading),
      copy: t('adminOrders.copy'),
      state: isOrdersError ? getMetricState(isOrdersError, ordersError, t('common.failedToLoad')) : '',
      to: '/admin/orders',
    },
  ];

  return (
    <section className="adminPage">
      <section className="adminPageMetrics">
        {metrics.map(metric => (
          <Link className={`adminPageMetric adminPageMetric--${metric.tone}`} to={metric.to} key={metric.label}>
            <span className="adminPageMetric-label">{metric.label}</span>
            <strong className="adminPageMetric-value">{metric.value}</strong>
            <span className="adminPageMetric-copy">{metric.copy}</span>
            {metric.state ? <span className="adminPageMetric-state">{metric.state}</span> : null}
          </Link>
        ))}
      </section>
    </section>
  );
}
