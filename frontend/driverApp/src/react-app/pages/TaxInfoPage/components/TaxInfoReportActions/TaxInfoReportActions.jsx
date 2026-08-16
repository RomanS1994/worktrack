import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TaxInfoReportActions.css';

const actions = [
  {
    id: 'pdf',
    icon: 'file',
    path: 'pdf',
    tone: 'red',
  },
  {
    id: 'excel',
    icon: 'excel',
    path: 'excel',
    tone: 'green',
  },
  {
    id: 'accountant',
    icon: 'wallet',
    path: 'accountant',
    tone: 'blue',
  },
];

export function TaxInfoReportActions({ monthKey }) {
  const { t } = useI18n();

  return (
    <section className="taxInfoReportActions" aria-label={t('settings.taxInfo.reportsTitle')}>
      {actions.map(action => (
        <Link
          className={`taxInfoReportAction taxInfoReportAction--${action.tone}`}
          key={action.id}
          to={`/settings/tax-info/${action.path}?month=${monthKey}`}
        >
          <span className={`taxInfoReportAction-icon taxInfoReportAction-icon--${action.tone}`} aria-hidden="true">
            <SvgIcon name={action.icon} />
          </span>
          <strong>{t(`settings.taxInfo.actionCards.${action.id}.title`)}</strong>
          <span>{t(`settings.taxInfo.actionCards.${action.id}.subtitle`)}</span>
          <span className="taxInfoReportAction-arrow" aria-hidden="true">
            <SvgIcon name="chevron-right" />
          </span>
        </Link>
      ))}
    </section>
  );
}
