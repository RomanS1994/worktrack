import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { PlanUpgradeForm } from './components/PlanUpgradeForm/PlanUpgradeForm.jsx';
import './PlanUpgradePage.css';

export function PlanUpgradePage() {
  const { t } = useI18n();

  return (
    <section className="planUpgradePage pageStack">
      <header className="planUpgradePage-header">
        <BackButton to="/settings" />

        <div className="appTitleBlock">
          <h1>{t('settings.planUpgrade.title')}</h1>
          <p>{t('settings.planUpgrade.subtitle')}</p>
        </div>
      </header>

      <section className="screenCard planUpgradePage-card">
        <PlanUpgradeForm />
      </section>
    </section>
  );
}
