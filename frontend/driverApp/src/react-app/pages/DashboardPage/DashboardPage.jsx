import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import './DashboardPage.css';

function getDisplayName(user) {
  return user?.firstName || user?.name || user?.email || 'WorkTrack user';
}

export function DashboardPage() {
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);
  const primaryItems = isManager
    ? [
        { label: 'Employees', value: '0', note: 'Active employees', icon: 'accounts' },
        { label: 'Pending', value: '0', note: 'Weekly submissions', icon: 'check-circle' },
        { label: 'Approved', value: '0 h', note: 'This payroll week', icon: 'clock' },
        { label: 'Payroll', value: '0 CZK', note: 'Confirmed amount', icon: 'wallet' },
      ]
    : [
        { label: 'Draft', value: '0 h', note: 'Current week', icon: 'clock' },
        { label: 'Submitted', value: '0 h', note: 'Waiting for review', icon: 'send' },
        { label: 'Approved', value: '0 h', note: 'Confirmed hours', icon: 'check-circle' },
        { label: 'Salary', value: '0 CZK', note: 'Confirmed amount', icon: 'wallet' },
      ];

  return (
    <section className="dashboardPage pageStack">
      <header className="dashboardHero">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{isManager ? 'Manager workspace' : 'Employee workspace'}</p>
          <h1>Dashboard</h1>
          <p>{getDisplayName(user)}</p>
        </div>
      </header>

      <section className="dashboardMetrics" aria-label="Workspace summary">
        {primaryItems.map(item => (
          <article className="dashboardMetric" key={item.label}>
            <span className="dashboardMetric-icon" aria-hidden="true">
              <SvgIcon name={item.icon} />
            </span>
            <span className="dashboardMetric-label">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="dashboardPanel screenCard">
        <div className="compactHeader">
          <h2>{isManager ? 'Weekly review' : 'Current week'}</h2>
          <p>{isManager ? 'No submitted weeks yet.' : 'No draft hours yet.'}</p>
        </div>

        <div className="dashboardActions">
          <Link className="dashboardActionLink" to="/hours">
            <span aria-hidden="true">
              <SvgIcon name="clock" />
            </span>
            Hours
          </Link>

          {isManager ? (
            <Link className="dashboardActionLink" to="/employees">
              <span aria-hidden="true">
                <SvgIcon name="accounts" />
              </span>
              Employees
            </Link>
          ) : null}
        </div>
      </section>
    </section>
  );
}
