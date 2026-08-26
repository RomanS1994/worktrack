import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetMonthlyHoursQuery } from '../../features/worktrack/monthlyHoursApi.js';
import { useGetManagerPayrollQuery, useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './PayrollReportPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_KEYS = { DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', REJECTED: 'rejected' };
const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };
const MIXED_RATE_LABELS = { uk: 'Кілька ставок', cs: 'Více sazeb', en: 'Multiple rates' };
const FINANCE_COPY = {
  uk: {
    finance: 'Фінанси', week: 'Тиждень', month: 'Місяць', thisWeek: 'Цей тиждень', thisMonth: 'Цей місяць', expected: 'Очікувана зарплата',
    remaining: 'Залишилось', norm: 'год норми', details: 'Деталі', calculation: 'Розрахунок', confirmed: 'Підтверджено',
    pending: 'Очікує підтвердження', overtime: 'Понаднормові', total: 'Всього', rate: 'Ставка', hourlyRate: 'Погодинна ставка',
    taxNote: 'Податки та відрахування не враховано', download: 'Завантажити звіт PDF', share: 'Поділитися', help: 'Довідка',
  },
  cs: {
    finance: 'Finance', week: 'Týden', month: 'Měsíc', thisWeek: 'Tento týden', thisMonth: 'Tento měsíc', expected: 'Očekávaná mzda',
    remaining: 'Zbývá', norm: 'h normy', details: 'Detaily', calculation: 'Výpočet', confirmed: 'Potvrzeno',
    pending: 'Čeká na potvrzení', overtime: 'Přesčas', total: 'Celkem', rate: 'Sazba', hourlyRate: 'Hodinová sazba',
    taxNote: 'Daně a odvody nejsou zahrnuty', download: 'Stáhnout PDF report', share: 'Sdílet', help: 'Nápověda',
  },
  en: {
    finance: 'Finance', week: 'Week', month: 'Month', thisWeek: 'This week', thisMonth: 'This month', expected: 'Expected salary',
    remaining: 'Remaining', norm: 'h target', details: 'Details', calculation: 'Calculation', confirmed: 'Confirmed',
    pending: 'Pending confirmation', overtime: 'Overtime', total: 'Total', rate: 'Rate', hourlyRate: 'Hourly rate',
    taxNote: 'Taxes and deductions are not included', download: 'Download PDF report', share: 'Share', help: 'Help',
  },
};

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
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth()) {
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(endDate);
    return `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${monthYear}`;
  }
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

function formatMonth(anchor, locale) {
  const date = new Date(`${anchor.slice(0, 7)}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function ReportRow({ label, value, emphasize = false }) {
  return <div className={`payrollReport-row${emphasize ? ' is-emphasized' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmployeeFinanceDashboard({ anchor, companyName, hourlyRate, language, locale, localizedStatus, onChangeAnchor, onChangePeriod, period, submission, summary, user, week, workRules }) {
  const navigate = useNavigate();
  const copy = FINANCE_COPY[language] || FINANCE_COPY.uk;
  const totalHours = Number(summary.totalHours || 0);
  const approvedHours = Number(summary.approvedHours || 0);
  const pendingHours = Number(summary.pendingHours || 0);
  const confirmedSalary = Number(summary.confirmedSalaryCzk || 0);
  const pendingSalary = Number(summary.predictedSalaryCzk || 0);
  const expectedSalary = confirmedSalary + pendingSalary;
  const overtimeHours = period === 'week' ? Number(summary.overtimeHours || 0) : 0;
  const overtimeSalary = overtimeHours * Number(hourlyRate || 0);
  const status = localizedStatus(submission?.status);
  const dailyTarget = Number(workRules?.standardDailyHours || 8);
  const targetHours = Math.max(0.25, Number.isFinite(dailyTarget) ? dailyTarget : 8) * 5;
  const remainingHours = Math.max(targetHours - totalHours, 0);
  const progress = Math.min((totalHours / targetHours) * 100, 100);
  const periodLabel = period === 'month' ? formatMonth(anchor, locale) : formatPeriod(week?.weekStart, week?.weekEnd, locale);

  const handleShare = async () => {
    const payload = { title: copy.finance, text: `${companyName}: ${formatCzk(expectedSalary, locale)}`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { return; }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="employeeFinance noPrint">
      <header className="employeeFinance-heading">
        <h1>{copy.finance}</h1>
        <button className="employeeFinance-helpButton" type="button" aria-label={copy.help} title={copy.help}>?</button>
      </header>

      <div className="employeeFinance-tabs" role="tablist" aria-label={copy.finance}>
        <button className={period === 'week' ? 'is-active' : ''} type="button" role="tab" aria-selected={period === 'week'} onClick={() => onChangePeriod('week')}>{copy.week}</button>
        <button className={period === 'month' ? 'is-active' : ''} type="button" role="tab" aria-selected={period === 'month'} onClick={() => onChangePeriod('month')}>{copy.month}</button>
      </div>

      <section className="employeeFinance-periodNav" aria-label={period === 'month' ? copy.month : copy.week}>
        <button type="button" onClick={() => onChangeAnchor(-1)} aria-label="Previous period">‹</button>
        <div>
          <strong>{periodLabel}</strong>
          <span>{period === 'month' ? copy.thisMonth : copy.thisWeek}</span>
        </div>
        <button type="button" onClick={() => onChangeAnchor(1)} aria-label="Next period">›</button>
      </section>

      <section className="employeeFinance-hero">
        <div className="employeeFinance-heroTop">
          <div>
            <span>{copy.expected}</span>
            <strong>{formatCzk(expectedSalary, locale)}</strong>
            <small>{formatHours(totalHours, locale)} × {formatCzk(hourlyRate, locale)}</small>
          </div>
          {period === 'week' ? <span className="employeeFinance-status"><i />{status}</span> : null}
        </div>
        {period === 'week' ? (
          <>
            <div className="employeeFinance-progress" aria-label={`${formatHours(totalHours, locale)} / ${formatHours(targetHours, locale)}`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="employeeFinance-progressMeta">
              <span>{formatHours(totalHours, locale)} / {formatHours(targetHours, locale)} {copy.norm}</span>
              <span>{copy.remaining} {formatHours(remainingHours, locale)}</span>
            </div>
          </>
        ) : null}
      </section>

      <section className="employeeFinance-companyCard">
        <div className="employeeFinance-icon" aria-hidden="true">▦</div>
        <div className="employeeFinance-companyText">
          <strong>{companyName}</strong>
          <span>{getEmployeeName(user)} · {formatCzk(hourlyRate, locale)}/год</span>
        </div>
        <button className="employeeFinance-detailsButton" type="button" onClick={() => navigate('/profile')}>{copy.details}<span aria-hidden="true">›</span></button>
      </section>

      <section className="employeeFinance-card employeeFinance-calculationCard">
        <h2>{copy.calculation}</h2>
        <div className="employeeFinance-breakdownRow is-confirmed">
          <span><i />{copy.confirmed}</span>
          <strong>{formatHours(approvedHours, locale)}</strong>
          <b>{formatCzk(confirmedSalary, locale)}</b>
        </div>
        <div className="employeeFinance-breakdownRow is-pending">
          <span><i />{copy.pending}</span>
          <strong>{formatHours(pendingHours, locale)}</strong>
          <b>{formatCzk(pendingSalary, locale)}</b>
        </div>
        {period === 'week' ? (
          <div className="employeeFinance-breakdownRow is-overtime">
            <span><i />{copy.overtime}</span>
            <strong>{formatHours(overtimeHours, locale)}</strong>
            <b>{formatCzk(overtimeSalary, locale)}</b>
          </div>
        ) : null}
        <div className="employeeFinance-totalRow">
          <span>{copy.total}</span>
          <strong>{formatHours(totalHours, locale)}</strong>
          <b>{formatCzk(expectedSalary, locale)}</b>
        </div>
      </section>

      <section className="employeeFinance-card employeeFinance-rateCard">
        <div className="employeeFinance-rateLine">
          <div className="employeeFinance-rateIcon" aria-hidden="true">₭</div>
          <div><strong>{copy.rate}</strong><span>{copy.hourlyRate}</span></div>
          <b>{formatCzk(hourlyRate, locale)}/год</b>
        </div>
        <div className="employeeFinance-taxNote"><span aria-hidden="true">ⓘ</span>{copy.taxNote}</div>
      </section>

      <div className="employeeFinance-actions">
        <button className="employeeFinance-primaryAction" type="button" onClick={() => window.print()}><span aria-hidden="true">⇩</span>{copy.download}</button>
        <button className="employeeFinance-secondaryAction" type="button" onClick={handleShare}><span aria-hidden="true">⇧</span>{copy.share}</button>
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
  const [employeePeriod, setEmployeePeriod] = useState('week');
  const [employeeAnchor, setEmployeeAnchor] = useState(getLocalDateKey);
  const employeeMonth = employeeAnchor.slice(0, 7);

  const workSummaryQuery = useGetWorkSummaryQuery({ weekStart: employeeAnchor }, { skip: isManager || employeePeriod !== 'week' });
  const monthlyHoursQuery = useGetMonthlyHoursQuery(employeeMonth, { skip: isManager || employeePeriod !== 'month' });
  const managerPayrollQuery = useGetManagerPayrollQuery({ period: managerPeriod, anchor: managerAnchor }, { skip: !isManager });
  const activeQuery = isManager ? managerPayrollQuery : employeePeriod === 'month' ? monthlyHoursQuery : workSummaryQuery;
  const data = activeQuery.data;
  const error = activeQuery.error;
  const isLoading = activeQuery.isLoading || activeQuery.isFetching;
  const rawSummary = data?.summary || {};
  const summary = !isManager && employeePeriod === 'month'
    ? {
        totalHours: rawSummary.totalHours || '0.00',
        approvedHours: rawSummary.approvedHours || '0.00',
        pendingHours: rawSummary.pendingHours || '0.00',
        confirmedSalaryCzk: rawSummary.approvedAmountCzk || '0.00',
        predictedSalaryCzk: rawSummary.pendingAmountCzk || '0.00',
      }
    : rawSummary;
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
          anchor={employeeAnchor}
          companyName={companyName}
          hourlyRate={hourlyRate}
          language={language}
          locale={locale}
          localizedStatus={localizedStatus}
          onChangeAnchor={direction => setEmployeeAnchor(current => shiftAnchor(current, employeePeriod, direction))}
          onChangePeriod={nextPeriod => {
            setEmployeePeriod(nextPeriod);
            if (nextPeriod === 'month') setEmployeeAnchor(current => `${current.slice(0, 7)}-01`);
          }}
          period={employeePeriod}
          submission={submission}
          summary={summary}
          user={user}
          week={week}
          workRules={data?.workRules}
        />
      ) : null}

      {!isLoading && !error ? (
        <article className={`payrollReport-sheet${!isManager ? ' is-employee-print' : ''}`}>
          <header className="payrollReport-header">
            <div><p className="payrollReport-brand">WorkTrack</p><h2>{isManager ? t('payroll.companyReport') : t('payroll.employeeStatement')}</h2></div>
            <div className="payrollReport-company"><strong>{companyName}</strong><span>{isManager ? t('payroll.managerReport') : getEmployeeName(user)}</span></div>
          </header>
          <section className="payrollReport-meta">
            {!isManager && employeePeriod === 'week' && week ? (
              <>
                <ReportRow label={t('payroll.weekStart')} value={week.weekStart || '-'} />
                <ReportRow label={t('payroll.weekEnd')} value={week.weekEnd || '-'} />
                <ReportRow label={t('payroll.weekStatus')} value={localizedStatus(submission?.status)} />
                <ReportRow label={t('payroll.hourlyRate')} value={formatCzk(hourlyRate, locale)} />
              </>
            ) : !isManager ? (
              <>
                <ReportRow label={t('payroll.periodType')} value={t('payroll.month')} />
                <ReportRow label={t('payroll.period')} value={formatMonth(employeeAnchor, locale)} />
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
              <div className="payrollReport-tableWrap"><table className="payrollReport-table"><thead><tr><th>{t('payroll.employee')}</th><th>{t('payroll.status')}</th><th>{t('payroll.rate')}</th><th>{t('payroll.approved')}</th><th>{t('payroll.pending')}</th><th>{t('payroll.confirmed')}</th><th>{t('payroll.predicted')}</th></tr></thead><tbody>{managerEmployees.map(employee => <tr key={employee.id}><td><strong>{employee.name}</strong><span>{employee.email}</span></td><td>{localizedEmployeeStatus(employee.status)}</td><td>{employee.mixedRates ? (MIXED_RATE_LABELS[language] || MIXED_RATE_LABELS.uk) : formatCzk(employee.effectiveRateCzk || employee.hourlyRateCzk, locale)}</td><td>{formatHours(employee.summary?.approvedHours, locale)}</td><td>{formatHours(employee.summary?.pendingHours, locale)}</td><td>{formatCzk(employee.summary?.confirmedSalaryCzk, locale)}</td><td>{formatCzk(employee.summary?.predictedSalaryCzk, locale)}</td></tr>)}</tbody></table></div>
            </section>
          ) : null}
          <footer className="payrollReport-footer"><p>{t('payroll.footer')}</p><span>{t('payroll.generated')}</span></footer>
        </article>
      ) : null}
    </section>
  );
}
