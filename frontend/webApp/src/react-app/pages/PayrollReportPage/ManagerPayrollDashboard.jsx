import { formatCzk, formatHours } from '../../app/formatters.js';

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '—';
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
  const confirmed = Number(summary.confirmedSalaryCzk || 0);
  const expected = Number(summary.predictedSalaryCzk || 0);
  const pending = Math.max(expected - confirmed, 0);

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
          <button type="button" className={period === 'week' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('week')}>{t('payroll.week')}</button>
          <button type="button" className={period === 'month' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('month')}>{t('payroll.month')}</button>
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
        <div className="managerPayrollMobile-wallet" aria-hidden="true">▱</div>
        <span className="managerPayrollMobile-eyebrow">{t('payroll.predictedPayroll')}</span>
        <strong className="managerPayrollMobile-total">{formatCzk(expected, locale)}</strong>
        <div className="managerPayrollMobile-moneyGrid">
          <div><span>{t('payroll.confirmed')}</span><strong>{formatCzk(confirmed, locale)}</strong></div>
          <div><span>{t('payroll.pending')}</span><strong>{formatCzk(pending, locale)}</strong></div>
        </div>
        <div className="managerPayrollMobile-hours">
          <span><i className="is-confirmed" /> <b>{formatHours(summary.approvedHours, locale)}</b> {t('payroll.confirmed').toLowerCase()}</span>
          <span><i className="is-pending" /> <b>{formatHours(summary.pendingHours, locale)}</b> {t('payroll.pending').toLowerCase()}</span>
        </div>
      </section>

      <section className="managerPayrollMobile-employees">
        <header>
          <h2>{t('payroll.breakdown')}</h2>
          <span>{employees.length} {t('payroll.employees').toLowerCase()}</span>
        </header>
        <div className="managerPayrollMobile-list">
          {employees.map(employee => (
            <article className="managerPayrollMobile-employee" key={employee.id}>
              <div className="managerPayrollMobile-avatar" aria-hidden="true">{initials(employee.name)}</div>
              <div className="managerPayrollMobile-person">
                <strong>{employee.name}</strong>
                <span>{employee.mixedRates ? '—' : `${formatCzk(employee.effectiveRateCzk ?? employee.hourlyRateCzk, locale)}/год`}</span>
              </div>
              <span className="managerPayrollMobile-chevron" aria-hidden="true">›</span>
              <div className="managerPayrollMobile-employeeAmounts">
                <div className="is-confirmed"><span>● {t('payroll.confirmed')}</span><strong>{formatCzk(employee.summary?.confirmedSalaryCzk, locale)}</strong></div>
                <div className="is-pending"><span>◷ {t('payroll.pending')}</span><strong>{formatCzk(employee.summary?.predictedSalaryCzk, locale)}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
