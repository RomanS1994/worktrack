import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { GlobalRequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { AdminBottomTabs } from '../../components/AdminBottomTabs/AdminBottomTabs.jsx';
import './AdminLayout.css';

function isAuthRoute(pathname) {
  return pathname === '/sign-in';
}

export function AdminLayout({ children }) {
  const location = useLocation();
  const user = useSelector(selectUser);
  const { t } = useI18n();

  if (isAuthRoute(location.pathname)) {
    return (
      <div className="adminLayout adminLayout--auth">
        <GlobalRequestLoader />
        <div className="adminAuthShell">
          <p className="adminAuthShell-kicker">DocTra</p>
          <h1 className="adminAuthShell-title">{t('app.admin')}</h1>
          <p className="adminAuthShell-copy">{t('adminDashboard.copy')}</p>

          <div className="adminAuthShell-card">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="adminLayout adminLayout--workspace">
      <GlobalRequestLoader />
      <div className="adminLayout-shell">
        <header className="adminLayout-header">
          <div className="adminLayout-brand">
            <p className="adminLayout-kicker">DocTra</p>
            <p className="adminLayout-subtitle">{t('app.admin')}</p>
          </div>

          <div className="adminLayout-user">
            <span>{user?.name || user?.email || t('header.notSignedIn')}</span>
          </div>
        </header>

        <main className="adminLayout-main">{children}</main>
      </div>

      <AdminBottomTabs />
    </div>
  );
}
