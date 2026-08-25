import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetManagerPayrollQuery, useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './PayrollReportPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_KEYS = { DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', REJECTED: 'rejected' };
const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };

function formatCzk(value, locale) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} Kč`;
}

function formatHours(value, locale) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)} h`;
}

function getEmployeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || '—';
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftAnchor(anchor, period, direction) {
  const source = new Date(`${anchor}T00:00:00.000Z`);
  if (period === 'month') return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + direction, 1)).toISOString().slice(0, 10);
  return new Date(source.getTime() + direction * 7 * DAY_MS).toISOString().slice(0, 10);
}

function formatPeriod(start, end, locale) {
  if (!start || !end) return '—';
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} – ${formatter.format(new Date(`${end}T00:00:00.000Z`))}`;
}

function ReportRow({ label, value, emphasize = false }) {
  return <div className={`payrollReport-row${emphasize ? ' is-emphasized' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmployeeFinanceDashboard({ companyName, hourlyRate, locale, localizedStatus, submission, summary, t, user, week }) {
  const totalHours = Number(summary.totalHours || 0);
  const approvedHours = Number(summary.approvedHours || 0);
  const pendingHours = Number(summary.pendingHours || 0);
  const predictedSalary = Number(summary.predictedSalaryCzk || 0);
  const confirmedSalary = Number(summary.confirmedSalaryCzk || 0);
  const pendingSalary = Math.max(predictedSalary - confirmedSalary, 0);
  const status = localizedStatus(submission?.status);
  const progressTarget = Math.max(40, Math.ceil(totalHours));
  const progress = progressTarget > 0 ? Math.min((totalHours / progressTarget) * 100, 100) : 0;

  const handleShare = async () => {
    const shareData = { title: t('payroll.title'), text: `${companyName}: ${formatCzk(predictedSalary, locale)}`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
      return;
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="employeeFinance noPrint">
      <header className="employeeFinance-heading">
        <div>
          <p className="employeeFinance-kicker">WorkTrack</p>
          <h1>{t('navigation.finance')}</h1>
        </div>
        <span className="employeeFinance-status"><i />{status}</span>
      </header>

      <div className="employeeFinance-tabs" role="tablist" aria-label={t('payroll.periodType')}>
        <button className="is-active" type="button" role="tab" aria-selected="true">{t('payroll.week')}</button>
        <button type="button" role="tab" aria-selected="false" disabled>{t('payroll.month')}</button>
      </div>

      <section className="employeeFinance-period">
        <strong>{formatPeriod(week?.weekStart, week?.weekEnd, locale)}</strong>
        <span>{t('fastHours.thisWeek')}</span>
      </section>

      <section className="employeeFinance-hero">
        <div className="employeeFinance-heroTop">
          <div>
            <span>{t('payroll.predictedSalary')}</span>
            <strong>{formatCzk(predictedSalary, locale)}</strong>
            <small>{formatHours(totalHours, locale)} × {formatCzk(hourlyRate, locale)}</small>
          </div>
          <span className="employeeFinance-status is-inline"><i />{status}</span>
        </div>
        <div className="employeeFinance-progress" aria-label={`${formatHours(totalHours, locale)} / ${formatHours(progressTarget, locale)}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="employeeFinance-progressMeta">
          <span>{formatHours(totalHours, locale)} / {formatHours(progressTarget, locale)}</span>
        </div>
      </section>

      <section className="employeeFinance-companyCard">
        <div className="employeeFinance-icon" aria-hidden="true">▦</div>
        <div>
          <strong>{companyName}</strong>
          <span>{getEmployeeName(user)} · {formatCzk(hourlyRate, locale)}/h</span>
        </div>
      </section>

      <section className="employeeFinance-card">
        <h2>{t('payroll.breakdown')}</h2>
        <div className="employeeFinance-breakdownRow is-confirmed">
          <span><i />{t('payroll.approvedHours')}</span>
          <strong>{formatHours(approvedHours, locale)}</strong>
          <b>{formatCzk(confirmedSalary, locale)}</b>
        </div>
        <div className="employeeFinance-breakdownRow is-pending">
          <span><i />{t('payroll.pendingHours')}</span>
          <strong>{formatHours(pendingHours, locale)}</strong>
          <b>{formatCzk(pendingSalary, locale)}</b>
        </div>
        <div className="employeeFinance-totalRow">
          <span>{t('payroll.totalSavedHours')}</span>
          <strong>{formatHours(totalHours, locale)}</strong>
          <b>{formatCzk(predictedSalary, locale)}</b>
        </div>
      </section>

      <section className="employeeFinance-card employeeFinance-rateCard">
        <div>
          <span>{t('payroll.hourlyRate')}</span>
          <strong>{formatCzk(hourlyRate, locale)}/h</strong>
        </div>
      </section>

      <div className="employeeFinance-actions">
        <button className="employeeFinance-primaryAction" type="button" onClick={() => window.print()}>
          <span aria-hidden="true">↓</span>{t('payroll.print')}
        </button>
        <button className="employeeFinance-secondaryAction" type="button" onClick={handleShare}>
          <span aria-hidden="true">↗</span>{t('common.share')}
        </button>
      </div>
    </div>
  );
}

export function PayrollReportPage() {
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);
  const [managerPeriod, setManagerPeriod] = useState('week');
  const [managerAnchor, setManagerAnchor] = useState(getLocalDateKey);
  const workSummaryQuery = useGetWorkSummaryQuery({}, { skip: isManager });
  const managerPayrollQuery = useGetManagerPayrollQuery({ period: managerPeriod, anchor: managerAnchor }, { skip: !isManager });
  const activeQuery = isManager ? managerPayrollQuery : workSummaryQuery;
  const data = activeQuery.data;
  const error = activeQuery.error;
  const isLoading = activeQuery.isLoading || activeQuery.isFetching;
  const summary = data?.summary || {};
  const companyName = data?.company?.name || user?.activeCompany?.name || 'WorkTrack';
  const week = data?.week || null;
  const submission = data?.submission || null;
  const hourlyRate = data?.hourlyRateCzk || user?.activeMembership?.hourlyRateCzk || '0.00';
  const managerEmployees = Array.isArray(data?.employees) ? data.employees : [];
  const managerPeriodLabel = useMemo(() => {
    if (!data?.period?.start || !data?.period?.end) return '-';
    return formatPeriod(data.period.start, data.period.end, locale);
  }, [data?.period?.end, data?.period?.start, locale]);

  const localizedStatus = status => {
    const key = STATUS_KEYS[String(status || 'DRAFT').toUpperCase()] || 'draft';
    return t(`common.${key}`);
  };
  const localizedEmployeeStatus = status => String(status || '').toUpperCase() === 'ACTIVE' ? t('projects.active') : t('projects.inactive');

  return (
    <section className="payrollReportPage pageStack">
      {isManager ? (
        <>
          <header className="payrollReport-toolbar screenCard noPrint">
            <div className="compactHeader"><h1>{t('payroll.title')}</h1><p>{t('payroll.printCopy')}</p></div>
            <div className="payrollReport-actions"><Link to="/dashboard">{t('payroll.back')}</Link><button type="button" onClick={() => window.print()} disabled={isLoading || Boolean(error)}>{t('payroll.print')}</button></div>
          </header>

          <section className="payrollReport-filters screenCard noPrint" aria-label={t('payroll.period')}>
            <div className="payrollPeriodToggle" role="group" aria-label={t('payroll.periodType')}>
              <button className={managerPeriod === 'week' ? 'is-active' : ''} type="button" disabled={isLoading} onClick={() => setManagerPeriod('week')}>{t('payroll.week')}</button>
              <button className={managerPeriod === 'month' ? 'is-active' : ''} type="button" disabled={isLoading} onClick={() => setManagerPeriod('month')}>{t('payroll.month')}</button>
            </div>
            <div className="payrollPeriodNavigation">
              <button type="button" disabled={isLoading} onClick={() => setManagerAnchor(current => shiftAnchor(current, managerPeriod, -1))}>{t('payroll.previous')}</button>
              <label className="payrollPeriodDate"><span>{t('payroll.periodDate')}</span><input type="date" value={managerAnchor} disabled={isLoading} onChange={event => setManagerAnchor(event.target.value || getLocalDateKey())} /></label>
              <button type="button" disabled={isLoading} onClick={() => setManagerAnchor(current => shiftAnchor(current, managerPeriod, 1))}>{t('payroll.next')}</button>
              <button type="button" disabled={isLoading} onClick={() => setManagerAnchor(getLocalDateKey())}>{t('payroll.today')}</button>
            </div>
          </section>
        </>
      ) : null}

      {isLoading ? <RequestLoadingState label={t('payroll.preparing')} /> : null}
      {error ? <p className="statusNote is-error noPrint">{getApiErrorMessage(error)}</p> : null}

      {!isLoading && !error && !isManager ? (
        <EmployeeFinanceDashboard
          companyName={companyName}
          hourlyRate={hourlyRate}
          locale={locale}
          localizedStatus={localizedStatus}
          submission={submission}
          summary={summary}
          t={t}
          user={user}
          week={week}
        />
      ) : null}

      {!isLoading && !error ? (
        <article className={`payrollReport-sheet${!isManager ? ' is-employee-print' : ''}`}>
          <header className="payrollReport-header">
            <div><p className="payrollReport-brand">WorkTrack</p><h2>{isManager ? t('payroll.companyReport') : t('payroll.employeeStatement')}</h2></div>
            <div className="payrollReport-company"><strong>{companyName}</strong><span>{isManager ? t('payroll.managerReport') : getEmployeeName(user)}</span></div>
          </header>

          <section className="payrollReport-meta">
            {!isManager && week ? (
              <>
                <ReportRow label={t('payroll.weekStart')} value={week.weekStart || '-'} />
                <ReportRow label={t('payroll.weekEnd')} value={week.weekEnd || '-'} />
                <ReportRow label={t('payroll.weekStatus')} value={localizedStatus(submission?.status)} />
                <ReportRow label={t('payroll.hourlyRate')} value={formatCzk(hourlyRate, locale)} />
              </>
            ) : (
              <>
                <ReportRow label={t('payroll.periodType')} value={data?.period?.type === 'month' ? t('payroll.month') : t('payroll.week')} />
                <ReportRow label={t('payroll.period')} value={managerPeriodLabel} />
                <ReportRow label={t('payroll.employees')} value={String(summary.employeeCount || 0)} />
                <ReportRow label={t('payroll.employeesWithHours')} value={String(summary.employeesWithHours || 0)} />
              </>
            )}
          </section>

          <section className="payrollReport-summary">
            <h3>{isManager ? t('payroll.payrollTotals') : t('payroll.hoursSalary')}</h3>
            {isManager ? (
              <>
                <ReportRow label={t('payroll.approvedHours')} value={formatHours(summary.approvedHours, locale)} />
                <ReportRow label={t('payroll.pendingHours')} value={formatHours(summary.pendingHours, locale)} />
                <ReportRow label={t('payroll.confirmedPayroll')} value={formatCzk(summary.confirmedSalaryCzk, locale)} emphasize />
                <ReportRow label={t('payroll.predictedPayroll')} value={formatCzk(summary.predictedSalaryCzk, locale)} />
              </>
            ) : (
              <>
                <ReportRow label={t('payroll.totalSavedHours')} value={formatHours(summary.totalHours, locale)} />
                <ReportRow label={t('payroll.approvedHours')} value={formatHours(summary.approvedHours, locale)} />
                <ReportRow label={t('payroll.pendingHours')} value={formatHours(summary.pendingHours, locale)} />
                <ReportRow label={t('payroll.confirmedSalary')} value={formatCzk(summary.confirmedSalaryCzk, locale)} emphasize />
                <ReportRow label={t('payroll.predictedSalary')} value={formatCzk(summary.predictedSalaryCzk, locale)} />
              </>
            )}
          </section>

          {isManager ? (
            <section className="payrollReport-employeeSection">
              <div className="payrollReport-sectionHeader"><h3>{t('payroll.breakdown')}</h3><span>{managerEmployees.length} {t('payroll.employees').toLowerCase()}</span></div>
              <div className="payrollReport-tableWrap">
                <table className="payrollReport-table">
                  <thead><tr><th>{t('payroll.employee')}</th><th>{t('payroll.status')}</th><th>{t('payroll.rate')}</th><th>{t('payroll.approved')}</th><th>{t('payroll.pending')}</th><th>{t('payroll.confirmed')}</th><th>{t('payroll.predicted')}</th></tr></thead>
                  <tbody>
                    {managerEmployees.map(employee => (
                      <tr key={employee.id}>
                        <td><strong>{employee.name}</strong><span>{employee.email}</span></td>
                        <td>{localizedEmployeeStatus(employee.status)}</td>
                        <td>{formatCzk(employee.hourlyRateCzk, locale)}</td>
                        <td>{formatHours(employee.summary?.approvedHours, locale)}</td>
                        <td>{formatHours(employee.summary?.pendingHours, locale)}</td>
                        <td>{formatCzk(employee.summary?.confirmedSalaryCzk, locale)}</td>
                        <td>{formatCzk(employee.summary?.predictedSalaryCzk, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <footer className="payrollReport-footer"><p>{t('payroll.footer')}</p><span>{t('payroll.generated')}</span></footer>
        </article>
      ) : null}
    </section>
  );
}
