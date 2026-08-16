import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './HistoryToolbar.css';

function NewestIcon() {
  return <SvgIcon name="newest" />;
}

function OldestIcon() {
  return <SvgIcon name="oldest" />;
}

function TripDateIcon() {
  return <SvgIcon name="trip-date" />;
}

function formatSelectedDate(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

function HistoryToolbar({ showDateFilter, dateFilter, onDateChange, onResetDate, sortKey, onSortChange }) {
  const { t } = useI18n();
  const sortOptions = [
    { key: 'oldest', label: t('history.oldest'), icon: <OldestIcon /> },
    { key: 'newest', label: t('history.newest'), icon: <NewestIcon /> },
  ];

  const selectedDateLabel = formatSelectedDate(dateFilter);

  return (
    <div className="orderHistoryToolbar">
      <div className="orderHistorySortField" role="group" aria-label={t('history.sort')}>
        <span className="visuallyHidden">{t('history.sort')}</span>
        {sortOptions.map(option => (
          <button
            key={option.key}
            className={`orderHistorySortButton orderHistorySortButton--sort ${sortKey === option.key ? 'is-active' : ''}`}
            type="button"
            aria-pressed={sortKey === option.key}
            aria-label={option.label}
            title={option.label}
            onClick={() => onSortChange(option.key)}
          >
            {option.icon}
          </button>
        ))}
      </div>

      {showDateFilter ? (
        <div className="orderHistoryDateField" role="group" aria-label={t('history.tripDate')}>
          <label
            className={`orderHistorySortButton orderHistorySortButton--date ${dateFilter ? 'is-active' : ''}`}
            title={dateFilter ? `${t('history.tripDate')}: ${dateFilter}` : t('history.tripDate')}
          >
            <TripDateIcon />
            <input
              className="orderHistoryDateInput"
              type="date"
              value={dateFilter}
              onChange={event => onDateChange(event.target.value)}
              aria-label={t('history.tripDate')}
            />
          </label>

          <span className={`orderHistoryDateLabel ${dateFilter ? 'is-active' : ''}`}>
            {selectedDateLabel || t('history.date')}
          </span>

          <button
            className="orderHistorySortButton orderHistorySortButton--clear"
            type="button"
            aria-label={t('common.clear')}
            title={t('common.clear')}
            onClick={onResetDate}
            disabled={!dateFilter}
          >
            <SvgIcon name="clear" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { HistoryToolbar };
