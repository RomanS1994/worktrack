import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import './SettingsAccountSummary.css';

function getInitial(user) {
  // Показуємо першу букву для компактної аватарки.
  const value = user?.name || user?.email || 'D';
  return String(value).trim().charAt(0).toUpperCase() || 'D';
}

export function SettingsAccountSummary({ user }) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = user?.profile?.avatarUrl || user?.profile?.avatar || user?.avatarUrl || '';
  const hasAvatar = Boolean(avatarUrl);

  if (!user) {
      return (
        <section className="screenCard settingsAccountSummary">
          <div className="compactHeader">
          <h2>{t('settings.accountSummary.title')}</h2>
          <p>{t('settings.accountSummary.notLoggedIn')}</p>
          </div>
        </section>
      );
  }

  return (
    <section className="screenCard settingsAccountSummary">
      <div className="compactHeader">
        <h2>{t('settings.accountSummary.title')}</h2>
        <p>{t('settings.accountSummary.copy')}</p>
      </div>

      <Link className="settingsAccountSummary-link" to="/account">
        <span className="settingsAccountSummary-avatar" aria-hidden="true">
          {hasAvatar && !imageFailed ? (
            <img
              className="settingsAccountSummary-image"
              src={avatarUrl}
              alt=""
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="settingsAccountSummary-fallback">{getInitial(user)}</span>
          )}
        </span>

        <span className="settingsAccountSummary-copy">
          <strong>{user.name || t('common.unknownUser')}</strong>
          <span>{user.email || '-'}</span>
          <span>{t('auth.role')}: {user.role || '-'}</span>
        </span>

        <span className="settingsAccountSummary-chevron" aria-hidden="true">
          →
        </span>
      </Link>
    </section>
  );
}
