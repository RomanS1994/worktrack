import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { useI18n } from '../../i18n/useI18n.js';
import { SvgIcon } from '../SvgIcon/SvgIcon.jsx';
import { selectUser } from '../../../features/auth/authSlice.js';
import { hasManagerAccess } from '../../../features/auth/authAccess.js';
import './BottomTabs.css';

function getTabClassName({ isActive }, extraClassName = '') {
  const activeClassName = isActive ? ' is-active' : '';
  return `bottomTab${extraClassName}${activeClassName}`;
}

export function BottomTabs() {
  const { t } = useI18n();
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);

  return (
    <nav className="bottomTabs" aria-label={t('bottomTabs.navLabel')}>
      <NavLink className={linkProps => getTabClassName(linkProps)} to="/" end>
        <span className="bottomTab-icon" aria-hidden="true">
          <SvgIcon name="dashboard" />
        </span>
        <span className="bottomTab-label">{t('app.dashboard')}</span>
      </NavLink>

      {!isManager ? (
        <NavLink className={linkProps => getTabClassName(linkProps)} to="/hours">
          <span className="bottomTab-icon" aria-hidden="true">
            <SvgIcon name="clock" />
          </span>
          <span className="bottomTab-label">{t('app.hours')}</span>
        </NavLink>
      ) : null}

      {isManager ? (
        <>
          <NavLink
            className={linkProps => getTabClassName(linkProps, ' bottomTab-primary')}
            to="/employees"
          >
            <span className="bottomTab-icon" aria-hidden="true">
              <SvgIcon name="accounts" />
            </span>
            <span className="bottomTab-label">{t('app.employees')}</span>
          </NavLink>

          <NavLink className={linkProps => getTabClassName(linkProps)} to="/projects">
            <span className="bottomTab-icon" aria-hidden="true">
              <SvgIcon name="location" />
            </span>
            <span className="bottomTab-label">Projects</span>
          </NavLink>

          <NavLink className={linkProps => getTabClassName(linkProps)} to="/approvals">
            <span className="bottomTab-icon" aria-hidden="true">
              <SvgIcon name="check-circle" />
            </span>
            <span className="bottomTab-label">{t('app.approvals')}</span>
          </NavLink>
        </>
      ) : null}

      <NavLink className={linkProps => getTabClassName(linkProps)} to="/profile">
        <span className="bottomTab-icon" aria-hidden="true">
          <SvgIcon name="profile" />
        </span>
        <span className="bottomTab-label">{t('app.profile')}</span>
      </NavLink>
    </nav>
  );
}
