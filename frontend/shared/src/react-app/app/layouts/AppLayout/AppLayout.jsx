import { useSelector } from 'react-redux';

import { AuthSessionErrorModal } from '../../components/AuthSessionErrorModal/AuthSessionErrorModal.jsx';
import { BottomTabs } from '../../components/BottomTabs/BottomTabs.jsx';
import { GlobalRequestLoader } from '../../components/RequestLoader/RequestLoader.jsx';
import { SessionNotice } from '../../components/SessionNotice/SessionNotice.jsx';
import { selectToken, selectUser } from '../../../features/auth/authSlice.js';
import { hasActiveCompanyAccess } from '../../../features/auth/authAccess.js';
import './AppLayout.css';

export function AppLayout({ children }) {
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const showBottomTabs = Boolean(token && user && hasActiveCompanyAccess(user));
  const layoutClassName = [
    'appLayout',
    'appLayout--workspace',
    showBottomTabs ? 'appLayout--withNav' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClassName}>
      <GlobalRequestLoader />
      <AuthSessionErrorModal />
      <SessionNotice />
      <div className="appLayout-workspaceBody">
        <div className="pageContainer">
          <main className="appLayout-main">{children}</main>
        </div>
      </div>

      {showBottomTabs ? <BottomTabs /> : null}
    </div>
  );
}
