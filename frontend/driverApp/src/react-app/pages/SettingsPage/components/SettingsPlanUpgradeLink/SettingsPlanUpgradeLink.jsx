import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import './SettingsPlanUpgradeLink.css';

export function SettingsPlanUpgradeLink() {
  const { t } = useI18n();
  const user = useSelector(selectUser);
  const isExpired = user?.subscription?.status === 'expired';

  return (
    <section className="settingsPlanUpgradeLink">
      <Link className="settingsPlanUpgradeLink-row" to="/settings/plan-upgrade">
        <span className="settingsPlanUpgradeLink-icon" aria-hidden="true">
          <SvgIcon name="card" />
        </span>

        <span className="settingsPlanUpgradeLink-copy">
          <strong>{isExpired ? t('account.renewPlan') : t('account.upgrade')}</strong>
          <span>{isExpired ? t('account.renewPlanCopy') : t('account.upgradeCopy')}</span>
        </span>

        <span className="settingsPlanUpgradeLink-chevron" aria-hidden="true">
          →
        </span>
      </Link>
    </section>
  );
}
