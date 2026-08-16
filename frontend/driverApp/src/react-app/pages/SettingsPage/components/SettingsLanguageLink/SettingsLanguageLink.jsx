import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SettingsLanguageLink.css';

export function SettingsLanguageLink() {
  const { t } = useI18n();

  return (
    <section className="settingsLanguageLink">
      <Link className="settingsLanguageLink-row" to="/settings/language">
        <span className="settingsLanguageLink-icon" aria-hidden="true">
          <SvgIcon name="languages" />
        </span>

        <span className="settingsLanguageLink-copy">
          <strong>{t('settings.languageCard.title')}</strong>
          <span>{t('settings.languageCard.subtitle')}</span>
        </span>

        <span className="settingsLanguageLink-chevron" aria-hidden="true">
          →
        </span>
      </Link>
    </section>
  );
}
