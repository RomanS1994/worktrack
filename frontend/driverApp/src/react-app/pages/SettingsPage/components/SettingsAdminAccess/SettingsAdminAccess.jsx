import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SettingsAdminAccess.css';

export function SettingsAdminAccess() {
  const { t } = useI18n();
  const adminAppUrl =
    import.meta.env.VITE_ADMIN_APP_URL ||
    (import.meta.env.DEV
      ? 'http://localhost:4174/admin/accounts'
      : '/admin/accounts');

  return (
    <section className="screenCard settingsAdminAccess">
      <div className="compactHeader">
        <h2>{t('settings.adminAccess.title')}</h2>
        <p>{t('settings.adminAccess.copy')}</p>
      </div>

      <a className="settingsAdminAccess-link" href={adminAppUrl}>
        {t('settings.adminAccess.title')}
      </a>
    </section>
  );
}
