import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TaxInfoMonthSelector.css';

const MONTHS = {
  uk: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  cs: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
};

export function getTaxInfoMonthLabel(language, date) {
  const monthNames = MONTHS[language] || MONTHS.uk;

  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

export function TaxInfoMonthSelector({ date, onCurrentMonth, onNextMonth, onPreviousMonth }) {
  const { language, t } = useI18n();
  const monthLabel = getTaxInfoMonthLabel(language, date);

  return (
    <section className="taxInfoMonthSelector" aria-label={t('settings.taxInfo.monthNavigation')}>
      <button
        className="taxInfoMonthSelector-button"
        type="button"
        onClick={onPreviousMonth}
        aria-label={t('settings.taxInfo.previousMonth')}
      >
        <SvgIcon name="back" />
      </button>

      <button
        className="taxInfoMonthSelector-current"
        type="button"
        onClick={onCurrentMonth}
        aria-label={monthLabel}
      >
        <span>{monthLabel}</span>
        <span className="taxInfoMonthSelector-caret" aria-hidden="true">⌄</span>
      </button>

      <button
        className="taxInfoMonthSelector-button"
        type="button"
        onClick={onNextMonth}
        aria-label={t('settings.taxInfo.nextMonth')}
      >
        <SvgIcon name="chevron-right" />
      </button>
    </section>
  );
}
