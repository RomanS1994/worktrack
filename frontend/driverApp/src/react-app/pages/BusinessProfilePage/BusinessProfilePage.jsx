import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { BusinessProfileForm } from '@shared/features/auth/components/BusinessProfileForm/BusinessProfileForm.jsx';
import './BusinessProfilePage.css';

export function BusinessProfilePage() {
  const { t } = useI18n();

  return (
    <section className="businessProfilePage pageStack">
      <header className="businessProfilePage-header">
        <BackButton to="/settings" />

        <div className="appTitleBlock">
          <h1>{t('settings.businessProfile.title')}</h1>
          <p>{t('settings.businessProfile.subtitle')}</p>
        </div>
      </header>

      <section className="screenCard businessProfilePage-card">
        <BusinessProfileForm />
      </section>
    </section>
  );
}
