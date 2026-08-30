import { useMemo, useState } from 'react';

import { formatCzk, formatHours } from '../../app/formatters.js';
import './ManagerPayrollAdvances.css';

const COPY = {
  uk: { accrued: 'Нараховано', advances: 'Аванси', netPay: 'До виплати' },
  cs: { accrued: 'Nárok', advances: 'Zálohy', netPay: 'K výplatě' },
  en: { accrued: 'Accrued', advances: 'Advances', netPay: 'Net pay' },
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
  const selectedEmployee = useMemo(
    () => employees.find(employee => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );
  const visibleSummary = selectedEmployee?.summary || summary;
  const copy = copyForLocale(locale);
  const confirmed = Number(visibleSummary?.confirmedSalaryCzk || 0);
  const accrued = Number(visibleSummary?.predictedSalaryCzk || 0);
  const advances = Number(visibleSummary?.advancesCzk || 0);
  const netPay = Number(visibleSummary?.netPayCzk ?? Math.max(accrued - advances, 0));
  const pending = Math.max(accrued - confirmed, 0);
  const approvedHours = visibleSummary?.approvedHours || 0;
  const pendingHours = visibleSummary?.pendingHours || 0;

  const toggleEmployee = employeeId => {
    setSelectedEmployeeId(current => current === employeeId ? null : employeeId);
  };

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
                  <div><span>{copy.accrued}</span><strong>{formatCzk(employee.summary?.predictedSalaryCzk, locale)}</strong></div>
                  <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(employee.summary?.advancesCzk, locale)}</strong></div>
                  <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(employee.summary?.netPayCzk, locale)}</strong></div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
