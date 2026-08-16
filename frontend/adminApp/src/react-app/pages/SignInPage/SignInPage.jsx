import { useI18n } from '@shared/app/i18n/useI18n.js';
import { LoginForm } from '@shared/features/auth/components/LoginForm/LoginForm.jsx';

import './SignInPage.css';

export function SignInPage() {
  const { t } = useI18n();

  return (
    <section className="adminSignInPage pageStack">
      <div className="adminSignInPage-card">
        <div className="compactHeader">
          <h2>{t('auth.signInTitle')}</h2>
          <p>{t('auth.signInCopy')}</p>
        </div>
        <LoginForm />
      </div>
    </section>
  );
}
