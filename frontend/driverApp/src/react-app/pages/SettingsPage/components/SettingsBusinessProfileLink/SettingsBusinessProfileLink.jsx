import { Link } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './SettingsBusinessProfileLink.css';

export function SettingsBusinessProfileLink() {
  const { t } = useI18n();

  return (
    <section className="settingsBusinessProfileLink">
      <Link className="settingsBusinessProfileLink-row" to="/settings/business-profile">
        <span className="settingsBusinessProfileLink-icon" aria-hidden="true">
          <SvgIcon name="profile" />
        </span>

        <span className="settingsBusinessProfileLink-copy">
          <strong>{t('settings.businessProfile.title')}</strong>
          <span>{t('settings.businessProfile.subtitle')}</span>
        </span>

        <span className="settingsBusinessProfileLink-chevron" aria-hidden="true">
          →
        </span>
      </Link>
    </section>
  );
}
