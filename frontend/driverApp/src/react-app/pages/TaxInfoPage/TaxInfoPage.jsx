import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetOrdersQuery } from '../../features/orders/ordersApi.js';
import { TaxInfoDayOrdersModal } from './components/TaxInfoDayOrdersModal/TaxInfoDayOrdersModal.jsx';
import { TaxInfoIncomeCalendar } from './components/TaxInfoIncomeCalendar/TaxInfoIncomeCalendar.jsx';
import { TaxInfoMetricCards } from './components/TaxInfoMetricCards/TaxInfoMetricCards.jsx';
import { TaxInfoMonthSelector } from './components/TaxInfoMonthSelector/TaxInfoMonthSelector.jsx';
import { TaxInfoReportActions } from './components/TaxInfoReportActions/TaxInfoReportActions.jsx';
import {
  buildTaxMetricCards,
  buildTaxMonthData,
  getMonthKey,
  getMonthOrderQuery,
  getSelectedDayDetail,
  getTaxDayOrders,
  parseMonthKey,
} from './taxInfoData.js';
import './TaxInfoPage.css';

function getCurrentMonth() {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), 1);
}

export function TaxInfoPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [visibleMonth, setVisibleMonth] = useState(() => (
    parseMonthKey(searchParams.get('month'), getCurrentMonth())
  ));
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [openedDay, setOpenedDay] = useState(null);
  const monthQuery = useMemo(() => getMonthOrderQuery(visibleMonth), [visibleMonth]);
  const { data, isError, isFetching, isLoading } = useGetOrdersQuery(monthQuery);
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const monthData = useMemo(() => buildTaxMonthData(orders, visibleMonth), [orders, visibleMonth]);
  const monthStats = useMemo(() => buildTaxMetricCards(monthData), [monthData]);
  const selectedIncomeDay = getSelectedDayDetail(monthData, selectedDay);
  const openedDayOrders = useMemo(
    () => getTaxDayOrders(monthData, openedDay),
    [monthData, openedDay],
  );
  const monthKey = getMonthKey(visibleMonth);

  function changeMonth(step) {
    setVisibleMonth(current => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + step, 1);
      const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      setSelectedDay(day => Math.min(day, daysInNextMonth));
      setOpenedDay(null);

      return nextMonth;
    });
  }

  function openDayOrders(day) {
    setSelectedDay(day);
    setOpenedDay(day);
  }

  return (
    <section className="taxInfoPage pageStack">
      <header className="taxInfoPage-header">
        <BackButton to="/settings" />

        <div className="appTitleBlock">
          <h1>{t('settings.taxInfo.title')}</h1>
          <p>{t('settings.taxInfo.subtitle')}</p>
        </div>
      </header>

      <TaxInfoMonthSelector
        date={visibleMonth}
        onCurrentMonth={() => {
          const currentMonth = getCurrentMonth();
          const daysInCurrentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            0,
          ).getDate();
          setVisibleMonth(currentMonth);
          setSelectedDay(Math.min(new Date().getDate(), daysInCurrentMonth));
          setOpenedDay(null);
        }}
        onNextMonth={() => changeMonth(1)}
        onPreviousMonth={() => changeMonth(-1)}
      />
      <div className="taxInfoPage-desktopGrid">
        <div className="taxInfoPage-mainColumn">
          <TaxInfoMetricCards stats={monthStats} />
          {isLoading || isFetching ? (
            <RequestLoadingState className="taxInfoPage-state" label={t('common.loadingOrders')} />
          ) : null}
          {isError ? <p className="statusNote is-error">{t('common.failedOrder')}</p> : null}
          <TaxInfoIncomeCalendar
            date={visibleMonth}
            days={monthData.days}
            selectedDay={selectedDay}
            selectedDayDetail={selectedIncomeDay}
            onSelectDay={openDayOrders}
          />
        </div>

        <aside className="taxInfoPage-sideColumn">
          <TaxInfoReportActions monthKey={monthKey} />
        </aside>
      </div>
      <TaxInfoDayOrdersModal
        date={visibleMonth}
        day={openedDay}
        isOpen={Boolean(openedDay)}
        orders={openedDayOrders}
        onClose={() => setOpenedDay(null)}
      />
    </section>
  );
}
