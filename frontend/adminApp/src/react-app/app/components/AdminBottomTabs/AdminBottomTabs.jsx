import { NavLink } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './AdminBottomTabs.css';

function getTabClassName({ isActive }) {
  return `adminBottomTab${isActive ? ' is-active' : ''}`;
}

export function AdminBottomTabs() {
  const { t } = useI18n();

  return (
    <nav className="adminBottomTabs" aria-label={t('adminNav.navLabel')}>
      <NavLink className={getTabClassName} to="/admin" end>
        <span className="adminBottomTab-icon" aria-hidden="true">
          <SvgIcon name="dashboard" />
        </span>
        <span className="adminBottomTab-label">{t('adminNav.dashboard')}</span>
      </NavLink>

      <NavLink className={getTabClassName} to="/admin/accounts">
        <span className="adminBottomTab-icon" aria-hidden="true">
          <SvgIcon name="accounts" />
        </span>
        <span className="adminBottomTab-label">{t('adminDashboard.accounts')}</span>
      </NavLink>

      <NavLink className={getTabClassName} to="/admin/orders">
        <span className="adminBottomTab-icon" aria-hidden="true">
          <SvgIcon name="orders" />
        </span>
        <span className="adminBottomTab-label">{t('adminDashboard.orders')}</span>
      </NavLink>

      <NavLink className={getTabClassName} to="/admin/settings">
        <span className="adminBottomTab-icon" aria-hidden="true">
          <SvgIcon name="settings" />
        </span>
        <span className="adminBottomTab-label">{t('adminNav.settings')}</span>
      </NavLink>
    </nav>
  );
}
