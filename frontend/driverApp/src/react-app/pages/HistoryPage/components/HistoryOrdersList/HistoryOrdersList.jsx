import { useState } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { HistoryOrderCard } from '../HistoryOrderCard/HistoryOrderCard.jsx';
import { isOrderCompletedByTime } from '../../historyUtils.js';
import './HistoryOrdersList.css';

function HistoryOrdersList({ orders, onOpen, referenceDate }) {
  const [completedOpen, setCompletedOpen] = useState(false);
  const { t } = useI18n();
  const activeOrders = [];
  const completedOrders = [];

  for (const order of orders) {
    if (isOrderCompletedByTime(order, referenceDate)) {
      completedOrders.push(order);
    } else {
      activeOrders.push(order);
    }
  }

  return (
    <ul className="ordersList orderHistoryList">
      {activeOrders.map(order => (
        <HistoryOrderCard key={order.id} order={order} onOpen={onOpen} referenceDate={referenceDate} />
      ))}

      {completedOrders.length ? (
        <li className={`orderHistoryCompletedBlock ${completedOpen ? 'is-open' : ''}`}>
          <button
            className="orderHistoryCompletedToggle"
            type="button"
            aria-expanded={completedOpen}
            onClick={() => setCompletedOpen(value => !value)}
          >
            <span className="orderHistoryCompletedToggleIcon" aria-hidden="true">
              <SvgIcon name="chevron-right" />
            </span>
            <span className="orderHistoryCompletedToggleLabel">{t('history.completedGroup')}</span>
            <span className="orderHistoryCompletedToggleCount">{completedOrders.length}</span>
          </button>

          {completedOpen ? (
            <ul className="ordersList orderHistoryCompletedList">
              {completedOrders.map(order => (
                <HistoryOrderCard key={order.id} order={order} onOpen={onOpen} referenceDate={referenceDate} />
              ))}
            </ul>
          ) : null}
        </li>
      ) : null}
    </ul>
  );
}

export { HistoryOrdersList };
