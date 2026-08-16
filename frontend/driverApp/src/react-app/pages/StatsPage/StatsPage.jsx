import { useState } from 'react';

import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetOrdersQuery } from '../../features/orders/ordersApi.js';
import { useGetUsageQuery } from '@shared/features/auth/authApi.js';
import { StatsActivityPanel } from './components/StatsActivityPanel/StatsActivityPanel.jsx';
import { StatsTabs } from './components/StatsTabs/StatsTabs.jsx';
import { StatsSalaryPanel } from './components/StatsSalaryPanel/StatsSalaryPanel.jsx';
import { StatsUsagePanel } from './components/StatsUsagePanel/StatsUsagePanel.jsx';
import './StatsPage.css';

function getSafeUsage(usage) {
  // Захищаємо екран від неповної відповіді API.
  return {
    month: usage?.month || '',
    periodStart: usage?.periodStart || '',
    periodEnd: usage?.periodEnd || '',
    cycleLabel: usage?.cycleLabel || 'Current cycle',
    status: usage?.status || 'active',
    used: usage?.used || 0,
    limit: usage?.limit || 0,
    remaining: usage?.remaining || 0,
    percent: usage?.percent || 0,
    deletedMessages: usage?.deletedMessages || 0,
    deletedMessagesThisMonth: usage?.deletedMessagesThisMonth || 0,
    orderCount: usage?.orderCount || 0,
  };
}

export function StatsPage() {
  const [activeTab, setActiveTab] = useState('usage');
  const { t } = useI18n();
  const shouldLoadOrders = activeTab !== 'usage';
  const { data: usageData, isLoading: isUsageLoading, isError: isUsageError } = useGetUsageQuery(
    undefined,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    },
  );
  const { data: ordersData, isLoading: isOrdersLoading, isError: isOrdersError } =
    useGetOrdersQuery({ limit: 1000 }, {
      skip: !shouldLoadOrders,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    });

  const usage = getSafeUsage(usageData?.usage);
  const orders = ordersData?.orders || [];
  const isLoading = isUsageLoading || (shouldLoadOrders && isOrdersLoading);
  const isError = isUsageError || (shouldLoadOrders && isOrdersError);

  return (
    <section className="statsPage pageStack">
      <div className="screenCard screenCard-stats">
        <div className="compactHeader">
          <h2>{t('stats.title')}</h2>
          <p>{t('stats.subtitle')}</p>
        </div>

        <StatsTabs value={activeTab} onChange={setActiveTab} />

        {isLoading ? <RequestLoadingState className="statusNote" label={t('stats.loading')} /> : null}
        {isError ? <p className="statusNote is-error">{t('stats.failed')}</p> : null}

        {!isLoading && !isError && activeTab === 'usage' ? (
          <StatsUsagePanel usage={usage} orders={orders} />
        ) : null}

        {!isLoading && !isError && activeTab === 'salary' ? (
          <StatsSalaryPanel usage={usage} orders={orders} />
        ) : null}

        {!isLoading && !isError && activeTab === 'activity' ? (
          <StatsActivityPanel usage={usage} orders={orders} />
        ) : null}
      </div>
    </section>
  );
}
