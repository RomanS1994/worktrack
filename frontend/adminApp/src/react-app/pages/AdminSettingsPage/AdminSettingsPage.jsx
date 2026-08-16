import { Link } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import './AdminSettingsPage.css';

export function AdminSettingsPage() {
  const { t } = useI18n();
  const driverAccountUrl =
    import.meta.env.VITE_DRIVER_APP_URL ||
    (import.meta.env.DEV ? 'http://localhost:5173/account' : '/account');

  function handleOpenDriverAccount() {
    window.open(driverAccountUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="adminSettingsPage">
      <div className="adminSettingsPage-header">
        <h2 className="adminSettingsPage-title">{t('adminSettings.title')}</h2>
        <p className="adminSettingsPage-copy">{t('adminSettings.subtitle')}</p>
      </div>

      <div className="adminSettingsPage-grid">
        <button
          className="adminSettingsPage-button adminSettingsPage-button--primary"
          type="button"
          onClick={handleOpenDriverAccount}
        >
          <span className="adminSettingsPage-linkTitle">{t('adminSettings.driverAccount')}</span>
        </button>

        <Link className="adminSettingsPage-link" to="/admin/settings/language">
          <span className="adminSettingsPage-linkTitle">{t('adminSettings.language')}</span>
          <span className="adminSettingsPage-linkCopy">{t('adminSettings.languageCopy')}</span>
        </Link>

        <Link className="adminSettingsPage-link" to="/admin/settings/audit">
          <span className="adminSettingsPage-linkTitle">{t('adminSettings.audit')}</span>
          <span className="adminSettingsPage-linkCopy">{t('adminSettings.auditCopy')}</span>
        </Link>
      </div>
    </section>
  );
}
