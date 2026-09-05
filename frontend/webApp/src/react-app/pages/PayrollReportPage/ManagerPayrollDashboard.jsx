import { useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { formatCzk, formatHours } from '../../app/formatters.js';
import { useGetManagerSubmissionsQuery, useReopenSubmissionMutation } from '../../features/worktrack/worktrackApi.js';
import './ManagerPayrollAdvances.css';

const COPY = {
  uk: {
    accrued: 'Нараховано', advances: 'Залоги', netPay: 'До виплати', approvedTitle: 'Погоджені години', approvedHint: 'Знайдіть будь-яке попереднє погодження за працівником або місяцем і, за потреби, поверніть його назад на перевірку.', reopen: 'Скасувати погодження', reopenConfirm: 'Скасувати погодження цих годин і повернути їх у статус «На перевірці»?', reopened: 'Погодження скасовано. Години знову очікують перевірки.', noApproved: 'Немає погоджених подань за вибраними фільтрами.', employeeFilter: 'Працівник', allEmployees: 'Усі працівники', monthFilter: 'Місяць', allMonths: 'Усі місяці', resetFilters: 'Скинути', shown: 'Знайдено',
  },
  cs: {
    accrued: 'Nárok', advances: 'Zálohy', netPay: 'K výplatě', approvedTitle: 'Schválené hodiny', approvedHint: 'Najděte libovolné dřívější schválení podle zaměstnance nebo měsíce a v případě potřeby jej vraťte ke kontrole.', reopen: 'Zrušit schválení', reopenConfirm: 'Zrušit schválení těchto hodin a vrátit je do stavu ke kontrole?', reopened: 'Schválení bylo zrušeno. Hodiny znovu čekají na kontrolu.', noApproved: 'Pro zvolené filtry nejsou žádná schválená podání.', employeeFilter: 'Zaměstnanec', allEmployees: 'Všichni zaměstnanci', monthFilter: 'Měsíc', allMonths: 'Všechny měsíce', resetFilters: 'Resetovat', shown: 'Nalezeno',
  },
  en: {
    accrued: 'Accrued', advances: 'Advances', netPay: 'Net pay', approvedTitle: 'Approved hours', approvedHint: 'Find any previous approval by employee or month and return it to review if it needs correction.', reopen: 'Undo approval', reopenConfirm: 'Undo approval for these hours and return them to review?', reopened: 'Approval undone. The hours are pending review again.', noApproved: 'No approved submissions match the selected filters.', employeeFilter: 'Employee', allEmployees: 'All employees', monthFilter: 'Month', allMonths: 'All months', resetFilters: 'Reset', shown: 'Found',
  },
};

function copyForLocale(locale = '') {
  const key = String(locale).toLowerCase().startsWith('cs') ? 'cs' : String(locale).toLowerCase().startsWith('en') ? 'en' : 'uk';
  return COPY[key];
}

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '—';
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5h13A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20h-13A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4h11" />
      <path d="M20 11.5h-4.25a2.25 2.25 0 0 0 0 4.5H20" />
      <circle cx="15.75" cy="13.75" r=".65" />
    </svg>
  );
}

function accruedAmount(summary) {
  if (summary?.accruedSalaryCzk != null) return Number(summary.accruedSalaryCzk || 0);
  return Number(summary?.confirmedSalaryCzk || 0) + Number(summary?.predictedSalaryCzk || 0);
}

function submissionName(submission) {
  return submission?.employee?.name || submission?.employee?.email || '—';
}

function submissionPeriod(submission, locale) {
  if (!submission?.weekStart || !submission?.weekEnd) return '—';
  const fmt = value => new Intl.DateTimeFormat(locale || 'uk-UA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  return `${fmt(submission.weekStart)} – ${fmt(submission.weekEnd)}`;
}

function submissionTouchesMonth(submission, month) {
  if (!month) return true;
  const start = String(submission?.weekStart || '').slice(0, 7);
  const end = String(submission?.weekEnd || '').slice(0, 7);
  return start === month || end === month;
}

export function ManagerPayrollDashboard({
  anchor,
  employees,
  isLoading,
  locale,
  onAnchorChange,
  onPeriodChange,
  onShift,
  onPrint,
  period,
  periodLabel,
  summary,
  t,
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [approvedEmployeeId, setApprovedEmployeeId] = useState('');
  const [approvedMonth, setApprovedMonth] = useState('');
  const [reopenMessage, setReopenMessage] = useState('');
  const [reopenError, setReopenError] = useState('');
  const selectedEmployee = useMemo(
    () => employees.find(employee => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );
  const visibleSummary = selectedEmployee?.summary || summary;
  const copy = copyForLocale(locale);
  const confirmed = Number(visibleSummary?.confirmedSalaryCzk || 0);
  const accrued = accruedAmount(visibleSummary);
  const advances = Number(visibleSummary?.advancesCzk || 0);
  const netPay = Number(visibleSummary?.netPayCzk ?? Math.max(accrued - advances, 0));
  const pending = Number(visibleSummary?.predictedSalaryCzk || 0);
  const approvedHours = visibleSummary?.approvedHours || 0;
  const pendingHours = visibleSummary?.pendingHours || 0;
  const approvedQuery = useGetManagerSubmissionsQuery({ status: 'APPROVED' });
  const [reopenSubmission, reopenState] = useReopenSubmissionMutation();
  const allApprovedSubmissions = useMemo(
    () => (Array.isArray(approvedQuery.data?.submissions) ? approvedQuery.data.submissions : []),
    [approvedQuery.data],
  );
  const approvedSubmissions = useMemo(
    () => allApprovedSubmissions.filter(submission => (
      (!approvedEmployeeId || submission.employeeMembershipId === approvedEmployeeId) &&
      submissionTouchesMonth(submission, approvedMonth)
    )),
    [allApprovedSubmissions, approvedEmployeeId, approvedMonth],
  );

  const toggleEmployee = employeeId => {
    setSelectedEmployeeId(current => current === employeeId ? null : employeeId);
  };

  function resetApprovedFilters() {
    setApprovedEmployeeId('');
    setApprovedMonth('');
  }

  async function undoApproval(submission) {
    if (!submission?.id || reopenState.isLoading || !window.confirm(copy.reopenConfirm)) return;
    setReopenMessage('');
    setReopenError('');
    try {
      await reopenSubmission(submission.id).unwrap();
      setReopenMessage(copy.reopened);
    } catch (error) {
      setReopenError(getApiErrorMessage(error));
    }
  }

  return (
    <div className="managerPayrollMobile noPrint">
      <header className="managerPayrollMobile-header">
        <h1>{t('payroll.title')}</h1>
        <button type="button" className="managerPayrollMobile-pdf" onClick={onPrint} disabled={isLoading}>
          <span aria-hidden="true">⇩</span>
          <span>PDF</span>
        </button>
      </header>

      <section className="managerPayrollMobile-controls" aria-label={t('payroll.period')}>
        <div className="managerPayrollMobile-toggle" role="group" aria-label={t('payroll.periodType')}>
          <button type="button" className={period === 'month' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('month')}>{t('payroll.month')}</button>
          <button type="button" className={period === 'week' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('week')}>{t('payroll.week')}</button>
        </div>
        <div className="managerPayrollMobile-dateNav">
          <button type="button" className="managerPayrollMobile-arrow" disabled={isLoading} onClick={() => onShift(-1)} aria-label={t('payroll.previous')}>‹</button>
          <label className="managerPayrollMobile-date">
            <span>{periodLabel}</span>
            <input type="date" value={anchor} disabled={isLoading} onChange={event => onAnchorChange(event.target.value)} aria-label={t('payroll.periodDate')} />
          </label>
          <button type="button" className="managerPayrollMobile-arrow" disabled={isLoading} onClick={() => onShift(1)} aria-label={t('payroll.next')}>›</button>
        </div>
      </section>

      <section className="managerPayrollMobile-hero">
        <div className="managerPayrollMobile-wallet"><WalletIcon /></div>
        <span className="managerPayrollMobile-eyebrow">
          {selectedEmployee ? `${copy.netPay} · ${selectedEmployee.name}` : copy.netPay}
        </span>
        <strong className="managerPayrollMobile-total">{formatCzk(netPay, locale)}</strong>
        <div className="managerPayrollMobile-moneyGrid is-net-pay">
          <div><span>{copy.accrued}</span><strong>{formatCzk(accrued, locale)}</strong></div>
          <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(advances, locale)}</strong></div>
          <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(netPay, locale)}</strong></div>
        </div>
        <div className="managerPayrollMobile-hours">
          <span><i className="is-confirmed" /> <b>{formatHours(approvedHours, locale)}</b> {t('payroll.confirmed').toLowerCase()}</span>
          <span><i className="is-pending" /> <b>{formatHours(pendingHours, locale)}</b> {t('payroll.pending').toLowerCase()} · {formatCzk(pending, locale)}</span>
        </div>
      </section>

      <section className="managerPayrollMobile-employees">
        <header>
          <h2>{t('payroll.breakdown')}</h2>
          <span>{employees.length} {t('payroll.employees').toLowerCase()}</span>
        </header>
        <div className="managerPayrollMobile-list">
          {employees.map(employee => {
            const isSelected = employee.id === selectedEmployeeId;
            const employeeAccrued = accruedAmount(employee.summary);
            return (
              <button
                type="button"
                className={`managerPayrollMobile-employee${isSelected ? ' is-selected' : ''}`}
                key={employee.id}
                onClick={() => toggleEmployee(employee.id)}
                aria-pressed={isSelected}
              >
                <div className="managerPayrollMobile-avatar" aria-hidden="true">{initials(employee.name)}</div>
                <div className="managerPayrollMobile-person">
                  <strong>{employee.name}</strong>
                  <span>{employee.mixedRates ? '—' : `${formatCzk(employee.effectiveRateCzk ?? employee.hourlyRateCzk, locale)}/год`}</span>
                </div>
                <span className="managerPayrollMobile-chevron" aria-hidden="true">{isSelected ? '⌃' : '›'}</span>
                <div className="managerPayrollMobile-employeeAmounts is-net-pay">
                  <div><span>{copy.accrued}</span><strong>{formatCzk(employeeAccrued, locale)}</strong></div>
                  <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(employee.summary?.advancesCzk, locale)}</strong></div>
                  <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(employee.summary?.netPayCzk, locale)}</strong></div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="managerPayrollMobile-employees managerPayrollMobile-approvedHistory">
        <header>
          <div>
            <h2>{copy.approvedTitle}</h2>
            <p>{copy.approvedHint}</p>
          </div>
          <span>{copy.shown}: {approvedSubmissions.length}</span>
        </header>

        <div className="managerPayrollMobile-approvedFilters">
          <label>
            <span>{copy.employeeFilter}</span>
            <select value={approvedEmployeeId} onChange={event => setApprovedEmployeeId(event.target.value)}>
              <option value="">{copy.allEmployees}</option>
              {employees.map(employee => <option value={employee.id} key={employee.id}>{employee.name}</option>)}
            </select>
          </label>
          <label>
            <span>{copy.monthFilter}</span>
            <input type="month" value={approvedMonth} onChange={event => setApprovedMonth(event.target.value)} aria-label={copy.monthFilter} />
          </label>
          {(approvedEmployeeId || approvedMonth) ? <button type="button" className="managerPayrollMobile-resetApproved" onClick={resetApprovedFilters}>{copy.resetFilters}</button> : null}
        </div>

        {reopenMessage ? <p className="statusNote is-success">{reopenMessage}</p> : null}
        {reopenError ? <p className="statusNote is-error">{reopenError}</p> : null}
        <div className="managerPayrollMobile-list">
          {approvedQuery.isLoading ? <p className="statusNote">…</p> : null}
          {approvedQuery.error ? <p className="statusNote is-error">{getApiErrorMessage(approvedQuery.error)}</p> : null}
          {!approvedQuery.isLoading && !approvedQuery.error && !approvedSubmissions.length ? <p className="statusNote">{copy.noApproved}</p> : null}
          {approvedSubmissions.map(submission => (
            <button
              type="button"
              className="managerPayrollMobile-employee managerPayrollMobile-approvedSubmission"
              key={submission.id}
              disabled={reopenState.isLoading}
              onClick={() => undoApproval(submission)}
            >
              <div className="managerPayrollMobile-avatar" aria-hidden="true">{initials(submissionName(submission))}</div>
              <div className="managerPayrollMobile-person">
                <strong>{submissionName(submission)}</strong>
                <span>{submissionPeriod(submission, locale)} · {formatHours(submission.summary?.totalHours || 0, locale)}</span>
              </div>
              <div className="managerPayrollMobile-employeeAmounts is-net-pay">
                <div className="is-net"><span>{copy.approvedTitle}</span><strong>{copy.reopen}</strong></div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
