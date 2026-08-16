import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { OrderDetails } from '../../features/orders/components/OrderDetails/OrderDetails.jsx';
import { useGetOrdersQuery } from '../../features/orders/ordersApi.js';
import { WorkspaceTabs } from '../../components/WorkspaceTabs/WorkspaceTabs.jsx';
import { HistoryOrdersList } from './components/HistoryOrdersList/HistoryOrdersList.jsx';
import { HistoryTabs } from './components/HistoryTabs/HistoryTabs.jsx';
import { HistoryToolbar } from './components/HistoryToolbar/HistoryToolbar.jsx';
import { buildTabCounts, compareOrders, getHistoryBucket, getHistoryDateKey } from './historyUtils.js';
import './HistoryPage.css';

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState('today');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState('oldest');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const { data, isLoading, isError } = useGetOrdersQuery();
  const { t } = useI18n();
  const orders = data?.orders || [];
  const showDateFilter = activeTab !== 'today';
  const referenceDate = useMemo(() => new Date(currentTime), [currentTime]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (!showDateFilter || !dateFilter) {
      return orders;
    }

    return orders.filter(order => getHistoryDateKey(order) === dateFilter);
  }, [dateFilter, orders, showDateFilter]);

  const tabCounts = useMemo(() => buildTabCounts(orders), [orders]);

  const visibleOrders = useMemo(() => {
    const list = [];

    for (const order of filteredOrders) {
      const bucket = getHistoryBucket(order).bucket;
      if (bucket !== activeTab) {
        continue;
      }

      list.push(order);
    }

    return [...list].sort((left, right) => compareOrders(left, right, sortKey, { referenceDate }));
  }, [activeTab, filteredOrders, referenceDate, sortKey]);

  function handleCloseDetails() {
    setSelectedOrderId('');
  }

  function handleOpenDetails(orderId) {
    setSelectedOrderId(orderId);
  }

  return (
    <section className="historyPage pageStack">
      <WorkspaceTabs />

      <div className="screenCard screenCard-stats">
        <HistoryTabs activeTab={activeTab} counts={tabCounts} onChange={setActiveTab} />

        <HistoryToolbar
          showDateFilter={showDateFilter}
          dateFilter={dateFilter}
          onDateChange={setDateFilter}
          onResetDate={() => setDateFilter('')}
          sortKey={sortKey}
          onSortChange={setSortKey}
        />

        {isLoading ? (
          <RequestLoadingState className="orderHistoryEmpty" label={t('history.loading')} />
        ) : null}
        {isError ? <p className="orderHistoryEmpty">{t('history.failed')}</p> : null}

        {!isLoading && !isError && !visibleOrders.length ? (
          <p className="orderHistoryEmpty">
            {dateFilter ? t('history.noMatch') : orders.length ? t('history.emptyTab') : t('history.empty')}
          </p>
        ) : null}
      </div>

      {!isLoading && !isError && visibleOrders.length ? (
        <HistoryOrdersList orders={visibleOrders} onOpen={handleOpenDetails} referenceDate={referenceDate} />
      ) : null}

      {selectedOrderId ? <OrderDetails orderId={selectedOrderId} onClose={handleCloseDetails} /> : null}
    </section>
  );
}
