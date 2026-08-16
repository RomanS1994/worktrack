import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SettingsTaxInfoLink.css';

export function SettingsTaxInfoLink() {
  const { t } = useI18n();

  return (
    <section className="settingsTaxInfoLink">
      <Link className="settingsTaxInfoLink-row" to="/settings/tax-info">
        <span className="settingsTaxInfoLink-icon" aria-hidden="true">
          <SvgIcon name="invoice" />
        </span>

        <span className="settingsTaxInfoLink-copy">
          <strong>{t('settings.taxInfo.title')}</strong>
          <span>{t('settings.taxInfo.menuSubtitle')}</span>
        </span>

        <span className="settingsTaxInfoLink-badge">{t('settings.taxInfo.badge')}</span>
      </Link>
    </section>
  );
}
