import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './HistoryTabs.css';

function HistoryTabs({ activeTab, counts, onChange }) {
  const { t } = useI18n();
  function isActive(tab) {
    return activeTab === tab;
  }

  return (
    <div className="orderHistoryTabs" role="tablist" aria-label={t('history.orderStatusTabs')}>
      <button
        className={`orderHistoryTab ${isActive('today') ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={isActive('today')}
        onClick={() => onChange('today')}
      >
        <span className="orderHistoryTabIcon" aria-hidden="true">
          <SvgIcon name="today" />
        </span>
        <span className="orderHistoryTabLabel">{t('history.today')}</span>
        <span className="orderHistoryTabCount" aria-hidden="true">{counts.today}</span>
      </button>

      <button
        className={`orderHistoryTab ${isActive('planned') ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={isActive('planned')}
        onClick={() => onChange('planned')}
      >
        <span className="orderHistoryTabIcon" aria-hidden="true">
          <SvgIcon name="planned" />
        </span>
        <span className="orderHistoryTabLabel">{t('history.planned')}</span>
        <span className="orderHistoryTabCount" aria-hidden="true">{counts.planned}</span>
      </button>

      <button
        className={`orderHistoryTab ${isActive('completed') ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={isActive('completed')}
        onClick={() => onChange('completed')}
      >
        <span className="orderHistoryTabIcon" aria-hidden="true">
          <SvgIcon name="completed" />
        </span>
        <span className="orderHistoryTabLabel">{t('history.completed')}</span>
        <span className="orderHistoryTabCount" aria-hidden="true">{counts.completed}</span>
      </button>
    </div>
  );
}

export { HistoryTabs };
