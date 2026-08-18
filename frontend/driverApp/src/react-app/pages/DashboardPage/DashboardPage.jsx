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

function getFirstName(user) {
  const name = getDisplayName(user);
  return String(name).split(/[\s@]/)[0] || 'there';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getCompanyName(user, data) {
  return data?.company?.name || user?.activeCompany?.name || 'Company workspace';
}

function formatCzk(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)} Kč`;
}

function buildManagerMetrics(summary = {}) {
  return [
    { label: 'Employees', value: String(summary.employeeCount || 0), note: 'Active employees', icon: 'accounts' },
    { label: 'Projects', value: String(summary.activeProjectCount || 0), note: 'Active projects', icon: 'location' },
    { label: 'Pending approvals', value: String(summary.pendingSubmissions || 0), note: 'Weeks waiting', icon: 'clock', tone: 'warning' },
    { label: 'Payroll', value: formatCzk(summary.confirmedSalaryCzk), note: 'Confirmed amount', icon: 'wallet' },
  ];
}

function buildEmployeeMetrics(summary = {}) {
  return [
    { label: 'This week', value: `${summary.totalHours || '0.00'} h`, note: 'All saved entries', icon: 'clock' },
    { label: 'Pending', value: `${summary.pendingHours || '0.00'} h`, note: 'Draft or submitted', icon: 'send', tone: 'warning' },
    { label: 'Approved', value: `${summary.approvedHours || '0.00'} h`, note: 'Confirmed hours', icon: 'check-circle' },
    { label: 'Salary', value: formatCzk(summary.confirmedSalaryCzk), note: `${formatCzk(summary.predictedSalaryCzk)} predicted`, icon: 'wallet' },
  ];
}

function TeamList({ title, items, emptyText, tone = '' }) {
  return (
    <article className={`dashboardTeamCard ${tone}`}>
      <div className="dashboardTeamCard-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        <div className="dashboardTeamList">
          {items.map(item => (
            <div className="dashboardTeamItem" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.email}</span>
              </div>
              {item.rejectionReason ? <p>{item.rejectionReason}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="dashboardTeamEmpty">{emptyText}</p>
      )}
    </article>
  );
}

export function DashboardPage() {
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);
  const { data, error, isLoading } = useGetWorkSummaryQuery();
  const summary = data?.summary || {};
  const team = data?.team || {};
  const companyName = getCompanyName(user, data);
  const primaryItems = isManager ? buildManagerMetrics(summary) : buildEmployeeMetrics(summary);
  const pendingCount = Number(summary.pendingSubmissions || 0);

  return (
    <section className="dashboardPage pageStack">
      <header className="dashboardHero">
        <div className="dashboardHero-copy">
          <p className="sectionEyebrow">{isManager ? companyName : 'My workspace'}</p>
          <h1>{getGreeting()}, {getFirstName(user)} <span aria-hidden="true">👋</span></h1>
          <p>{isManager ? "Here’s what’s happening at WorkTrack today." : 'Your hours, approvals and salary in one place.'}</p>
        </div>
      </header>

      {isLoading ? <RequestLoadingState label="Loading dashboard" /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

      {isManager ? (
        <section className="dashboardAttentionCard" aria-label="Approvals requiring attention">
          <div className="dashboardAttentionIcon" aria-hidden="true"><SvgIcon name="check-circle" /></div>
          <div className="dashboardAttentionCopy">
            <span>Needs your attention</span>
            <h2>{pendingCount} {pendingCount === 1 ? 'week needs' : 'weeks need'} approval</h2>
            <p>Review submitted hours before they become confirmed payroll.</p>
          </div>
          <Link className="dashboardPrimaryAction" to="/approvals">Review approvals <span aria-hidden="true">→</span></Link>
        </section>
      ) : (
        <section className="dashboardAttentionCard dashboardAttentionCard--salary" aria-label="Salary summary">
          <div className="dashboardAttentionIcon" aria-hidden="true"><SvgIcon name="wallet" /></div>
          <div className="dashboardAttentionCopy">
            <span>Confirmed salary</span>
            <h2>{formatCzk(summary.confirmedSalaryCzk)}</h2>
            <p>{formatCzk(summary.predictedSalaryCzk)} predicted from pending hours.</p>
          </div>
          <Link className="dashboardPrimaryAction" to="/payroll-report">View payroll <span aria-hidden="true">→</span></Link>
        </section>
      )}

      <section className="dashboardMetrics" aria-label="Workspace summary">
        {primaryItems.map(item => (
          <article className={`dashboardMetric ${item.tone ? `is-${item.tone}` : ''}`} key={item.label}>
            <span className="dashboardMetric-icon" aria-hidden="true"><SvgIcon name={item.icon} /></span>
            <span className="dashboardMetric-label">{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="dashboardPanel screenCard">
        <div className="compactHeader">
          <h2>Quick actions</h2>
          <p>{isManager ? 'Jump to the areas you use most.' : 'Manage and review your work time.'}</p>
        </div>
        <div className="dashboardActions">
          {isManager ? (
            <>
              <Link className="dashboardActionLink dashboardActionLink--primary" to="/approvals"><span aria-hidden="true"><SvgIcon name="check-circle" /></span><strong>Review approvals</strong><small>{pendingCount} pending</small></Link>
              <Link className="dashboardActionLink" to="/employees"><span aria-hidden="true"><SvgIcon name="accounts" /></span><strong>Employees</strong><small>Manage team</small></Link>
              <Link className="dashboardActionLink" to="/projects"><span aria-hidden="true"><SvgIcon name="location" /></span><strong>Projects</strong><small>View worksites</small></Link>
              <Link className="dashboardActionLink" to="/payroll-report"><span aria-hidden="true"><SvgIcon name="wallet" /></span><strong>Payroll report</strong><small>Salary overview</small></Link>
            </>
          ) : (
            <>
              <Link className="dashboardActionLink dashboardActionLink--primary" to="/hours"><span aria-hidden="true"><SvgIcon name="clock" /></span><strong>My hours</strong><small>Add or edit entries</small></Link>
              <Link className="dashboardActionLink" to="/calendar"><span aria-hidden="true"><SvgIcon name="clock" /></span><strong>Calendar</strong><small>Monthly hours overview</small></Link>
              <Link className="dashboardActionLink" to="/payroll-report"><span aria-hidden="true"><SvgIcon name="wallet" /></span><strong>Payroll report</strong><small>Salary overview</small></Link>
            </>
          )}
        </div>
      </section>

      {isManager ? (
        <section className="dashboardPanel screenCard">
          <div className="compactHeader">
            <h2>Team this week</h2>
            <p>{summary.notSubmittedCount || 0} not submitted · {summary.needsChangesCount || 0} need changes</p>
          </div>
          <div className="dashboardTeamGrid">
            <TeamList title="Not submitted" items={team.notSubmitted || []} emptyText="Everyone has submitted." tone="is-warning" />
            <TeamList title="Needs changes" items={team.needsChanges || []} emptyText="No rejected weeks." tone="is-danger" />
            <TeamList title="Waiting review" items={team.submitted || []} emptyText="Nothing waiting for review." />
            <TeamList title="Approved" items={team.approved || []} emptyText="No approved weeks yet." tone="is-success" />
          </div>
        </section>
      ) : null}
    </section>
  );
}
