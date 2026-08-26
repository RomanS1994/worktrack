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

const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };

function getDisplayName(user) { return user?.firstName || user?.name || user?.email || 'WorkTrack user'; }
function getFirstName(user) { return String(getDisplayName(user)).split(/[\s@]/)[0] || ''; }
function getGreeting(t) { const hour = new Date().getHours(); if (hour < 12) return t('dashboard.goodMorning'); if (hour < 18) return t('dashboard.goodAfternoon'); return t('dashboard.goodEvening'); }
function getCompanyName(user, data, t) { return data?.company?.name || user?.activeCompany?.name || t('dashboard.companyWorkspace'); }
function formatCzk(value, locale) { const amount = Number(value || 0); return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} Kč`; }

export function DashboardPage() {
  const user = useSelector(selectUser);
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const isManager = hasManagerAccess(user);
  const { data, error, isLoading } = useGetWorkSummaryQuery();
  const summary = data?.summary || {};
  const companyName = getCompanyName(user, data, t);
  const pendingCount = Number(summary.pendingSubmissions || 0);
  const hasSummary = Boolean(data && !error && !isLoading);

  const managerStats = [
    { label: t('dashboard.employees'), value: String(summary.employeeCount || 0) },
    { label: t('dashboard.projects'), value: String(summary.activeProjectCount || 0) },
    { label: t('dashboard.pendingApprovals'), value: String(pendingCount), warning: pendingCount > 0 },
  ];
  const employeeStats = [
    { label: t('dashboard.thisWeek'), value: `${summary.totalHours || '0.00'} h` },
    { label: t('dashboard.approved'), value: `${summary.approvedHours || '0.00'} h` },
    { label: t('dashboard.salary'), value: formatCzk(summary.confirmedSalaryCzk, locale) },
  ];
  const stats = isManager ? managerStats : employeeStats;

  return <section className="dashboardPage pageStack">
    <header className="dashboardHero">
      <div className="dashboardHero-copy">
        <p className="sectionEyebrow">{isManager ? companyName : t('dashboard.myWorkspace')}</p>
        <h1>{getGreeting(t)}, {getFirstName(user)} <span aria-hidden="true">👋</span></h1>
      </div>
    </header>

    {isLoading ? <RequestLoadingState label={t('dashboard.loading')} /> : null}
    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

    {hasSummary ? <>
      {isManager ? (
        <Link className={`dashboardFocusCard${pendingCount ? ' is-warning' : ''}`} to="/approvals">
          <span className="dashboardFocusIcon"><SvgIcon name="check-circle" /></span>
          <span className="dashboardFocusCopy"><small>{t('dashboard.needsAttention')}</small><strong>{t(pendingCount === 1 ? 'dashboard.weekNeedsApproval' : 'dashboard.weeksNeedApproval', { count: pendingCount })}</strong><em>{t('dashboard.reviewSubmittedHours')}</em></span>
          <b aria-hidden="true">›</b>
        </Link>
      ) : (
        <Link className="dashboardFocusCard" to="/hours">
          <span className="dashboardFocusIcon"><SvgIcon name="clock" /></span>
          <span className="dashboardFocusCopy"><small>{t('dashboard.thisWeek')}</small><strong>{summary.totalHours || '0.00'} h</strong><em>{t('dashboard.addEditEntries')}</em></span>
          <b aria-hidden="true">›</b>
        </Link>
      )}

      <section className="dashboardCompactStats" aria-label={t('dashboard.workspaceSummary')}>
        {stats.map(item => <article key={item.label} className={item.warning ? 'is-warning' : ''}><span>{item.label}</span><strong>{item.value}</strong></article>)}
      </section>

      <section className="dashboardShortcuts">
        {isManager ? <>
          <Link to="/employees"><span><SvgIcon name="accounts" /></span><strong>{t('dashboard.employees')}</strong><small>{t('dashboard.manageTeam')}</small><b>›</b></Link>
          <Link to="/finance"><span><SvgIcon name="wallet" /></span><strong>{t('dashboard.payroll')}</strong><small>{formatCzk(summary.confirmedSalaryCzk, locale)}</small><b>›</b></Link>
        </> : <>
          <Link to="/finance"><span><SvgIcon name="wallet" /></span><strong>{t('dashboard.salary')}</strong><small>{t('dashboard.predictedFromPending', { amount: formatCzk(summary.predictedSalaryCzk, locale) })}</small><b>›</b></Link>
          <Link to="/calendar"><span><SvgIcon name="calendar" /></span><strong>{t('dashboard.calendar')}</strong><small>{t('dashboard.monthlyOverview')}</small><b>›</b></Link>
        </>}
      </section>
    </> : null}
  </section>;
}
