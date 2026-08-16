import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SettingsTeamLink.css';

export function SettingsTeamLink() {
  const { t } = useI18n();

  return (
    <section className="settingsTeamLink">
      <Link className="settingsTeamLink-row" to="/settings/team">
        <span className="settingsTeamLink-icon" aria-hidden="true">
          <SvgIcon name="accounts" />
        </span>

        <span className="settingsTeamLink-copy">
          <strong>{t('settings.team.title')}</strong>
          <span>{t('settings.team.subtitle')}</span>
        </span>

        <span className="settingsTeamLink-chevron" aria-hidden="true">
          →
        </span>
      </Link>
    </section>
  );
}
