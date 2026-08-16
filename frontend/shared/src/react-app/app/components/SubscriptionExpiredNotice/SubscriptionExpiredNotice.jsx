import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useI18n } from '../../i18n/useI18n.js';
import { selectToken, selectUser } from '../../../features/auth/authSlice.js';
import './SubscriptionExpiredNotice.css';

function isAdminOrManagerRoute(pathname) {
  return pathname.startsWith('/admin') || pathname.startsWith('/manager');
}

export function SubscriptionExpiredNotice() {
  const { t } = useI18n();
  const location = useLocation();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);

  if (
    !token ||
    !user ||
    isAdminOrManagerRoute(location.pathname) ||
    user.subscription?.status !== 'expired'
  ) {
    return null;
  }

  return (
    <div className="subscriptionExpiredNotice" role="status" aria-live="polite">
      <div className="subscriptionExpiredNotice-copy">
        <p className="subscriptionExpiredNotice-eyebrow">{t('account.planExpiredEyebrow')}</p>
        <p className="subscriptionExpiredNotice-text">{t('contract.subscriptionInactive')}</p>
      </div>

      <Link className="subscriptionExpiredNotice-button" to="/settings/plan-upgrade">
        {t('contract.openAccountForUpgrade')}
      </Link>
    </div>
  );
}
