import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SettingsProvidersLink.css';

export function SettingsProvidersLink() {
  const { t } = useI18n();

  return (
    <section className="settingsProvidersLink">
      <Link className="settingsProvidersLink-row" to="/settings/providers">
        <span className="settingsProvidersLink-icon" aria-hidden="true">
          <SvgIcon name="invoice" />
        </span>

        <span className="settingsProvidersLink-copy">
          <strong>{t('settings.providers.title')}</strong>
          <span>{t('settings.providers.menuSubtitle')}</span>
        </span>

        <span className="settingsProvidersLink-chevron" aria-hidden="true">
          <SvgIcon name="chevron-right" />
        </span>
      </Link>
    </section>
  );
}
