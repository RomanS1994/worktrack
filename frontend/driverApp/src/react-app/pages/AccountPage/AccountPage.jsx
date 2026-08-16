import { useSelector } from 'react-redux';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { AccountProfileForm } from '@shared/features/auth/components/AccountProfileForm/AccountProfileForm.jsx';
import { useGetUsageQuery } from '@shared/features/auth/authApi.js';
import { LoginForm } from '@shared/features/auth/components/LoginForm/LoginForm.jsx';
import { RegisterForm } from '@shared/features/auth/components/RegisterForm/RegisterForm.jsx';
import { ProfileDanger } from './components/ProfileDanger/ProfileDanger.jsx';
import { ProfileHero } from './components/ProfileHero/ProfileHero.jsx';
import { ProfileWorkspace } from './components/ProfileWorkspace/ProfileWorkspace.jsx';
import './AccountPage.css';

export function AccountPage() {
  const user = useSelector(selectUser);
  const { data, isLoading: isUsageLoading } = useGetUsageQuery(undefined, { skip: !user });
  const { t } = useI18n();
  const orderCount = data?.usage?.orderCount || 0;

  return (
    <section className="accountPage pageStack">
      <header className="appTop accountPage-top">
        <BackButton to="/settings" />
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{t('account.eyebrow')}</p>
          <h1>{t('account.title')}</h1>
          <p>{t('account.intro')}</p>
        </div>
      </header>

      {user ? (
        <>
          <ProfileHero user={user} />

          <div className="screenCard accountPage-card">
            <AccountProfileForm />
          </div>

          <ProfileWorkspace user={user} orderCount={orderCount} isOrdersLoading={isUsageLoading} />

          <ProfileDanger />
        </>
      ) : (
        <section className="screenCard profileAuth">
          <div className="compactHeader">
            <h2>{t('account.signIn')}</h2>
            <p>{t('account.signInCopy')}</p>
          </div>

          <div className="profileAuthForms">
            <LoginForm />
            <RegisterForm />
          </div>
        </section>
      )}
    </section>
  );
}
