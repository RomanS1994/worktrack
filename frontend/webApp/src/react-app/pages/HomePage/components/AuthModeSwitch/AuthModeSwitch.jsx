import { useI18n } from '@shared/app/i18n/useI18n.js';
import './AuthModeSwitch.css';

export function AuthModeSwitch({ value, onChange }) {
  const { t } = useI18n();

  return (
    <div className="authModeSwitch" role="tablist" aria-label={t('guest.docTra')}>
      <button
        className={`authModeSwitch-btn ${value === 'login' ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={value === 'login'}
        onClick={() => onChange('login')}
      >
        {t('auth.login')}
      </button>
      <button
        className={`authModeSwitch-btn ${value === 'register' ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={value === 'register'}
        onClick={() => onChange('register')}
      >
        {t('auth.register')}
      </button>
    </div>
  );
}
