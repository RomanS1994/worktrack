import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { AuthSessionErrorModal } from '../../components/AuthSessionErrorModal/AuthSessionErrorModal.jsx';
import { BottomTabs } from '../../components/BottomTabs/BottomTabs.jsx';
import { NotificationBell } from '../../components/NotificationBell/NotificationBell.jsx';
import { GlobalRequestLoader } from '../../components/RequestLoader/RequestLoader.jsx';
import { SessionNotice } from '../../components/SessionNotice/SessionNotice.jsx';
import { selectToken, selectUser } from '../../../features/auth/authSlice.js';
import { hasActiveCompanyAccess } from '../../../features/auth/authAccess.js';
import { ChatFab } from '../../../features/chat/ChatFab.jsx';
import { ChatLiveSync } from '../../../features/chat/ChatLiveSync.jsx';
import './AppLayout.css';
import './BackgroundRedesign.css';

export function AppLayout({ children }) {
  const location = useLocation();
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const showWorkspaceNav = Boolean(token && user && hasActiveCompanyAccess(user));
  const isChatPage = location.pathname === '/chat';
  const layoutClassName = [
    'appLayout',
    'appLayout--workspace',
    showWorkspaceNav ? 'appLayout--withNav' : '',
    isChatPage ? 'appLayout--chat' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClassName}>
      <GlobalRequestLoader />
      <AuthSessionErrorModal />
      <SessionNotice />
      {showWorkspaceNav ? <ChatLiveSync /> : null}
      {showWorkspaceNav ? <NotificationBell /> : null}
      <div className="appLayout-workspaceBody">
        <div className="pageContainer">
          <main className="appLayout-main">{children}</main>
        </div>
      </div>

      {showWorkspaceNav ? <ChatFab /> : null}
      {showWorkspaceNav ? <BottomTabs /> : null}
    </div>
  );
}
