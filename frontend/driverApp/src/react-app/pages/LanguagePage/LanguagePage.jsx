import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SettingsLanguageCard } from '../SettingsPage/components/SettingsLanguageCard/SettingsLanguageCard.jsx';
import './LanguagePage.css';

export function LanguagePage() {
  const { t } = useI18n();

  return (
    <section className="languagePage pageStack">
      <header className="languagePage-header">
        <BackButton to="/settings" />

        <div className="appTitleBlock">
          <h1>{t('settings.languageCard.title')}</h1>
          <p>{t('settings.languageCard.subtitle')}</p>
        </div>
      </header>

      <SettingsLanguageCard showHeader={false} />
    </section>
  );
}
