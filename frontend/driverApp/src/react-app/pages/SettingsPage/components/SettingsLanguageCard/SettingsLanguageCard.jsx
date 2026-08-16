import './SettingsLanguageCard.css';
import { useI18n } from '@shared/app/i18n/useI18n.js';

export function SettingsLanguageCard({ showHeader = true }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <section className="screenCard settingsLanguageCard">
      {showHeader ? (
        <div className="compactHeader">
          <h2>{t('settings.languageCard.title')}</h2>
          <p>{t('settings.languageCard.subtitle')}</p>
        </div>
      ) : null}

      <label className="settingsLanguageCard-field">
        <span className="settingsLanguageCard-label">{t('settings.languageCard.label')}</span>
        <select value={language} onChange={event => setLanguage(event.target.value)}>
          <option value="uk">{t('settings.languageCard.uk')}</option>
          <option value="en">{t('settings.languageCard.en')}</option>
          <option value="cs">{t('settings.languageCard.cs')}</option>
        </select>
      </label>

      <p className="settingsLanguageCard-note">{t('settings.languageCard.note')}</p>
    </section>
  );
}
