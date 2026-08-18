import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './DashboardPage.css';

function getDisplayName(user) {
  return user?.firstName || user?.name || user?.email || 'WorkTrack user';
}

function getCompanyName(user, data) {
  return data?.company?.name || user?.activeCompany?.name || 'Company workspace';
}

function formatCzk(value) {
  return `${value || '0.00'} CZK`;
}

function buildManagerMetrics(summary = {}) {
  return [
    {
      label: 'Employees',
      value: String(summary.employeeCount || 0),
      note: 'Active employees',
      icon: 'accounts',
    },
    {
      label: 'Projects',
      value: String(summary.activeProjectCount || 0),
      note: 'Active worksites',
      icon: 'location',
    },
    {
      label: 'Pending',
      value: String(summary.pendingSubmissions || 0),
      note: 'Weekly submissions',
      icon: 'check-circle',
    },
    {
      label: 'Payroll',
      value: formatCzk(summary.confirmedSalaryCzk),
      note: 'Confirmed amount',
      icon: 'wallet',
    },
  ];
}

function buildEmployeeMetrics(summary = {}) {
  return [
    {
      label: 'This week',
      value: `${summary.totalHours || '0.00'} h`,
      note: 'All saved entries',
      icon: 'clock',
    },
    {
      label: 'Pending',
      value: `${summary.pendingHours || '0.00'} h`,
      note: 'Draft or submitted',
      icon: 'send',
    },
    {
      label: 'Approved',
      value: `${summary.approvedHours || '0.00'} h`,
      note: 'Confirmed hours',
      icon: 'check-circle',
    },
    {
      label: 'Salary',
      value: formatCzk(summary.confirmedSalaryCzk),
      note: `${formatCzk(summary.predictedSalaryCzk)} predicted`,
      icon: 'wallet',
    },
  ];
}

export function DashboardPage() {
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);
  const { data, error, isLoading } = useGetWorkSummaryQuery();
  const summary = data?.summary || {};
  const companyName = getCompanyName(user, data);
  const primaryItems = isManager
    ? buildManagerMetrics(summary)
    : buildEmployeeMetrics(summary);

  return (
    <section className="dashboardPage pageStack">
      <header className="dashboardHero">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{isManager ? 'Manager workspace' : 'Employee workspace'}</p>
          <h1>Dashboard</h1>
          <p>{isManager ? companyName : getDisplayName(user)}</p>
        </div>
      </header>

      {isLoading ? <RequestLoadingState label="Loading dashboard" /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

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
          <p>
            {isManager
              ? `${summary.pendingSubmissions || 0} submissions waiting for review.`
              : `${data?.submission?.status || 'DRAFT'} week status.`}
          </p>
        </div>

        <div className="dashboardActions">
          {isManager ? (
            <>
              <Link className="dashboardActionLink" to="/approvals">
                <span aria-hidden="true">
                  <SvgIcon name="check-circle" />
                </span>
                Approvals
              </Link>

              <Link className="dashboardActionLink" to="/employees">
                <span aria-hidden="true">
                  <SvgIcon name="accounts" />
                </span>
                Employees
              </Link>

              <Link className="dashboardActionLink" to="/projects">
                <span aria-hidden="true">
                  <SvgIcon name="location" />
                </span>
                Projects
              </Link>

              <Link className="dashboardActionLink" to="/company-settings">
                <span aria-hidden="true">
                  <SvgIcon name="settings" />
                </span>
                Company
              </Link>

              <Link className="dashboardActionLink" to="/payroll-report">
                <span aria-hidden="true">
                  <SvgIcon name="wallet" />
                </span>
                Payroll report
              </Link>
            </>
          ) : (
            <>
              <Link className="dashboardActionLink" to="/hours">
                <span aria-hidden="true">
                  <SvgIcon name="clock" />
                </span>
                Hours
              </Link>

              <Link className="dashboardActionLink" to="/payroll-report">
                <span aria-hidden="true">
                  <SvgIcon name="wallet" />
                </span>
                Payroll report
              </Link>
            </>
          )}
        </div>
      </section>
    </section>
  );
}
