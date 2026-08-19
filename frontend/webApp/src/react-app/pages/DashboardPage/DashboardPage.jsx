import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './DashboardPage.css';

function getDisplayName(user) {
  return user?.firstName || user?.name || user?.email || 'WorkTrack user';
}

function getFirstName(user) {
  const name = getDisplayName(user);
  return String(name).split(/[\s@]/)[0] || '';
}

function getGreeting(t) {
  const hour = new Date().getHours();
  if (hour < 12) return t('dashboard.goodMorning');
  if (hour < 18) return t('dashboard.goodAfternoon');
  return t('dashboard.goodEvening');
}

function getCompanyName(user, data, t) {
  return data?.company?.name || user?.activeCompany?.name || t('dashboard.companyWorkspace');
}

function formatCzk(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} Kč`;
}

function buildManagerMetrics(summary, t) {
  return [
    { label: t('dashboard.employees'), value: String(summary.employeeCount || 0), note: t('dashboard.activeEmployees'), icon: 'accounts' },
    { label: t('dashboard.projects'), value: String(summary.activeProjectCount || 0), note: t('dashboard.activeProjects'), icon: 'location' },
    { label: t('dashboard.pendingApprovals'), value: String(summary.pendingSubmissions || 0), note: t('dashboard.weeksWaiting'), icon: 'clock', tone: 'warning' },
    { label: t('dashboard.payroll'), value: formatCzk(summary.confirmedSalaryCzk), note: t('dashboard.confirmedAmount'), icon: 'wallet' },
  ];
}

function buildEmployeeMetrics(summary, t) {
  return [
    { label: t('dashboard.thisWeek'), value: `${summary.totalHours || '0.00'} h`, note: t('dashboard.allSavedEntries'), icon: 'clock' },
    { label: t('dashboard.pending'), value: `${summary.pendingHours || '0.00'} h`, note: t('dashboard.draftOrSubmitted'), icon: 'send', tone: 'warning' },
    { label: t('dashboard.approved'), value: `${summary.approvedHours || '0.00'} h`, note: t('dashboard.confirmedHours'), icon: 'check-circle' },
    { label: t('dashboard.salary'), value: formatCzk(summary.confirmedSalaryCzk), note: `${formatCzk(summary.predictedSalaryCzk)} ${t('dashboard.predicted')}`, icon: 'wallet' },
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
              <div><strong>{item.name}</strong><span>{item.email}</span></div>
              {item.rejectionReason ? <p>{item.rejectionReason}</p> : null}
            </div>
          ))}
        </div>
      ) : <p className="dashboardTeamEmpty">{emptyText}</p>}
    </article>
  );
}

export function DashboardPage() {
  const user = useSelector(selectUser);
  const { t } = useI18n();
  const isManager = hasManagerAccess(user);
  const { data, error, isLoading } = useGetWorkSummaryQuery();
  const summary = data?.summary || {};
  const team = data?.team || {};
  const companyName = getCompanyName(user, data, t);
  const primaryItems = isManager ? buildManagerMetrics(summary, t) : buildEmployeeMetrics(summary, t);
  const pendingCount = Number(summary.pendingSubmissions || 0);

  return (
    <section className="dashboardPage pageStack">
      <header className="dashboardHero">
        <div className="dashboardHero-copy">
          <p className="sectionEyebrow">{isManager ? companyName : t('dashboard.myWorkspace')}</p>
          <h1>{getGreeting(t)}, {getFirstName(user)} <span aria-hidden="true">👋</span></h1>
          <p>{isManager ? t('dashboard.managerIntro') : t('dashboard.employeeIntro')}</p>
        </div>
      </header>

      {isLoading ? <RequestLoadingState label={t('dashboard.loading')} /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

      {isManager ? (
        <section className="dashboardAttentionCard" aria-label={t('dashboard.pendingApprovals')}>
          <div className="dashboardAttentionIcon" aria-hidden="true"><SvgIcon name="check-circle" /></div>
          <div className="dashboardAttentionCopy">
            <span>{t('dashboard.needsAttention')}</span>
            <h2>{t(pendingCount === 1 ? 'dashboard.weekNeedsApproval' : 'dashboard.weeksNeedApproval', { count: pendingCount })}</h2>
            <p>{t('dashboard.reviewSubmittedHours')}</p>
          </div>
          <Link className="dashboardPrimaryAction" to="/approvals">{t('dashboard.reviewApprovals')} <span aria-hidden="true">→</span></Link>
        </section>
      ) : (
        <section className="dashboardAttentionCard dashboardAttentionCard--salary" aria-label={t('dashboard.confirmedSalary')}>
          <div className="dashboardAttentionIcon" aria-hidden="true"><SvgIcon name="wallet" /></div>
          <div className="dashboardAttentionCopy">
            <span>{t('dashboard.confirmedSalary')}</span>
            <h2>{formatCzk(summary.confirmedSalaryCzk)}</h2>
            <p>{t('dashboard.predictedFromPending', { amount: formatCzk(summary.predictedSalaryCzk) })}</p>
          </div>
          <Link className="dashboardPrimaryAction" to="/payroll-report">{t('dashboard.viewPayroll')} <span aria-hidden="true">→</span></Link>
        </section>
      )}

      <section className="dashboardMetrics" aria-label={t('dashboard.workspaceSummary')}>
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
          <h2>{t('dashboard.quickActions')}</h2>
          <p>{isManager ? t('dashboard.managerQuickCopy') : t('dashboard.employeeQuickCopy')}</p>
        </div>
        <div className="dashboardActions">
          {isManager ? (
            <>
              <Link className="dashboardActionLink dashboardActionLink--primary" to="/approvals"><span aria-hidden="true"><SvgIcon name="check-circle" /></span><strong>{t('dashboard.reviewApprovals')}</strong><small>{t('dashboard.pendingCount', { count: pendingCount })}</small></Link>
              <Link className="dashboardActionLink" to="/employees"><span aria-hidden="true"><SvgIcon name="accounts" /></span><strong>{t('dashboard.employees')}</strong><small>{t('dashboard.manageTeam')}</small></Link>
              <Link className="dashboardActionLink" to="/projects"><span aria-hidden="true"><SvgIcon name="location" /></span><strong>{t('dashboard.projects')}</strong><small>{t('dashboard.viewWorksites')}</small></Link>
              <Link className="dashboardActionLink" to="/payroll-report"><span aria-hidden="true"><SvgIcon name="wallet" /></span><strong>{t('dashboard.payrollReport')}</strong><small>{t('dashboard.salaryOverview')}</small></Link>
            </>
          ) : (
            <>
              <Link className="dashboardActionLink dashboardActionLink--primary" to="/hours"><span aria-hidden="true"><SvgIcon name="clock" /></span><strong>{t('dashboard.myHours')}</strong><small>{t('dashboard.addEditEntries')}</small></Link>
              <Link className="dashboardActionLink" to="/calendar"><span aria-hidden="true"><SvgIcon name="clock" /></span><strong>{t('dashboard.calendar')}</strong><small>{t('dashboard.monthlyOverview')}</small></Link>
              <Link className="dashboardActionLink" to="/payroll-report"><span aria-hidden="true"><SvgIcon name="wallet" /></span><strong>{t('dashboard.payrollReport')}</strong><small>{t('dashboard.salaryOverview')}</small></Link>
            </>
          )}
        </div>
      </section>

      {isManager ? (
        <section className="dashboardPanel screenCard">
          <div className="compactHeader">
            <h2>{t('dashboard.teamThisWeek')}</h2>
            <p>{t('dashboard.teamSummary', { notSubmitted: summary.notSubmittedCount || 0, needsChanges: summary.needsChangesCount || 0 })}</p>
          </div>
          <div className="dashboardTeamGrid">
            <TeamList title={t('dashboard.notSubmitted')} items={team.notSubmitted || []} emptyText={t('dashboard.everyoneSubmitted')} tone="is-warning" />
            <TeamList title={t('dashboard.needsChanges')} items={team.needsChanges || []} emptyText={t('dashboard.noRejectedWeeks')} tone="is-danger" />
            <TeamList title={t('dashboard.waitingReview')} items={team.submitted || []} emptyText={t('dashboard.nothingWaiting')} />
            <TeamList title={t('dashboard.approvedWeeks')} items={team.approved || []} emptyText={t('dashboard.noApprovedWeeks')} tone="is-success" />
          </div>
        </section>
      ) : null}
    </section>
  );
}
