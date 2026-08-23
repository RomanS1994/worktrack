import { useI18n } from '@shared/app/i18n/useI18n.js';
import './AuthModeSwitch.css';

const COPY = {
  uk: { label: 'Режим автентифікації', login: 'Увійти', register: 'Реєстрація' },
  cs: { label: 'Způsob přihlášení', login: 'Přihlásit se', register: 'Registrace' },
  en: { label: 'Authentication mode', login: 'Sign in', register: 'Register' },
};

export function AuthModeSwitch({ value, onChange }) {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;

  return (
    <div className="authModeSwitch" role="tablist" aria-label={c.label}>
      <button
        className={`authModeSwitch-btn ${value === 'login' ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={value === 'login'}
        onClick={() => onChange('login')}
      >
        {c.login}
      </button>
      <button
        className={`authModeSwitch-btn ${value === 'register' ? 'is-active' : ''}`}
        type="button"
        role="tab"
        aria-selected={value === 'register'}
        onClick={() => onChange('register')}
      >
        {c.register}
      </button>
    </div>
  );
}
