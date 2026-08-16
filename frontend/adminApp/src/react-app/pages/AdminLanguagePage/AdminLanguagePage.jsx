import './AdminLanguagePage.css';
import { useI18n } from '@shared/app/i18n/useI18n.js';

export function AdminLanguagePage() {
  const { t } = useI18n();

  return (
    <section className="adminLanguagePage">
      <div className="adminLanguagePage-header">
        <h2 className="adminLanguagePage-title">{t('adminLanguage.title')}</h2>
        <p className="adminLanguagePage-copy">{t('adminLanguage.copy')}</p>
      </div>
    </section>
  );
}
