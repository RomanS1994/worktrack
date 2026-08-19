import { NavLink, useLocation } from 'react-router-dom';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './WorkspaceTabs.css';

function getTabClassName({ isActive }) {
  return `workspaceTabs-tab${isActive ? ' is-active' : ''}`;
}

function getTabsClassName(pathname) {
  if (pathname === '/available-orders') {
    return 'workspaceTabs workspaceTabs--available';
  }

  if (pathname === '/calendar') {
    return 'workspaceTabs workspaceTabs--calendar';
  }

  return 'workspaceTabs workspaceTabs--history';
}

function WorkspaceTab({ to, end = false, icon, children }) {
  return (
    <NavLink
      className={getTabClassName}
      to={to}
      end={end}
    >
      <span className="workspaceTabs-icon" aria-hidden="true">
        <SvgIcon name={icon} />
      </span>
      <span className="workspaceTabs-label">{children}</span>
    </NavLink>
  );
}

export function WorkspaceTabs() {
  const { t } = useI18n();
  const location = useLocation();

  return (
    <nav className={getTabsClassName(location.pathname)} aria-label={t('history.workspaceTabs')}>
      <WorkspaceTab to="/available-orders" icon="calendar">
        {t('history.available')}
      </WorkspaceTab>
      <WorkspaceTab to="/history" end icon="file">
        {t('history.myOrders')}
      </WorkspaceTab>
      <WorkspaceTab to="/calendar" icon="calendar">
        {t('history.calendar')}
      </WorkspaceTab>
    </nav>
  );
}
