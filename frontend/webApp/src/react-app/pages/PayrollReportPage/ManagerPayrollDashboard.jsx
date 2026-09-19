import { useMemo, useState } from 'react';

import { formatCzk, formatHours } from '../../app/formatters.js';
import './ManagerPayrollAdvances.css';
import './ManagerPayrollEmployeesToggle.css';

const COPY = {
  uk: { accrued: 'Нараховано', advances: 'Залоги', netPay: 'До виплати', laborMargin: 'Дохід із працівників', marginShort: 'дохід', multipleRates: 'Кілька ставок', rateUnit: 'Kč/год', showEmployees: 'Показати працівників', hideEmployees: 'Згорнути працівників' },
  cs: { accrued: 'Nárok', advances: 'Zálohy', netPay: 'K výplatě', laborMargin: 'Výnos ze zaměstnanců', marginShort: 'výnos', multipleRates: 'Více sazeb', rateUnit: 'Kč/h', showEmployees: 'Zobrazit zaměstnance', hideEmployees: 'Sbalit zaměstnance' },
  en: { accrued: 'Accrued', advances: 'Advances', netPay: 'Net pay', laborMargin: 'Employee margin', marginShort: 'margin', multipleRates: 'Multiple rates', rateUnit: 'CZK/h', showEmployees: 'Show employees', hideEmployees: 'Collapse employees' },
};

function copyForLocale(locale = '') {
  const key = String(locale).toLowerCase().startsWith('cs') ? 'cs' : String(locale).toLowerCase().startsWith('en') ? 'en' : 'uk';
  return COPY[key];
}

function initials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '—';
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

function ratePair(employee, locale, copy) {
  if (employee.mixedRates || employee.mixedCustomerRates) return copy.multipleRates;
  const payRate = employee.effectiveRateCzk ?? employee.hourlyRateCzk;
  const customerRate = employee.effectiveCustomerRateCzk ?? employee.customerRateCzk ?? payRate;
  return `${formatCzk(payRate, locale)} → ${formatCzk(customerRate, locale)} ${copy.rateUnit}`;
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
  const [employeesOpen, setEmployeesOpen] = useState(true);
  const selectedEmployee = useMemo(
    () => employees.find(employee => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );
  const visibleSummary = selectedEmployee?.summary || summary;
  const copy = copyForLocale(locale);
  const accrued = accruedAmount(visibleSummary);
  const advances = Number(visibleSummary?.advancesCzk || 0);
  const netPay = Number(visibleSummary?.netPayCzk ?? Math.max(accrued - advances, 0));
  const laborMargin = Number(visibleSummary?.laborMarginCzk || 0);
  const pending = Number(visibleSummary?.predictedSalaryCzk || 0);
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
          <span aria-hidden="true">⇩</span><span>PDF</span>
        </button>
      </header>

      <section className="managerPayrollMobile-controls" aria-label={t('payroll.period')}>
        <div className="managerPayrollMobile-toggle" role="group" aria-label={t('payroll.periodType')}>
          <button type="button" className={period === 'month' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('month')}>{t('payroll.month')}</button>
          <button type="button" className={period === 'week' ? 'is-active' : ''} disabled={isLoading} onClick={() => onPeriodChange('week')}>{t('payroll.week')}</button>
        </div>
        <div className="managerPayrollMobile-dateNav">
          <button type="button" className="managerPayrollMobile-arrow" disabled={isLoading} onClick={() => onShift(-1)} aria-label={t('payroll.previous')}>‹</button>
          <label className="managerPayrollMobile-date"><span>{periodLabel}</span><input type="date" value={anchor} disabled={isLoading} onChange={event => onAnchorChange(event.target.value)} aria-label={t('payroll.periodDate')} /></label>
          <button type="button" className="managerPayrollMobile-arrow" disabled={isLoading} onClick={() => onShift(1)} aria-label={t('payroll.next')}>›</button>
        </div>
      </section>

      <section className="managerPayrollMobile-hero">
        <div className="managerPayrollMobile-wallet"><WalletIcon /></div>
        <span className="managerPayrollMobile-eyebrow">{selectedEmployee ? `${copy.netPay} · ${selectedEmployee.name}` : copy.netPay}</span>
        <strong className="managerPayrollMobile-total">{formatCzk(netPay, locale)}</strong>
        <div className="managerPayrollMobile-moneyGrid is-net-pay">
          <div><span>{copy.accrued}</span><strong>{formatCzk(accrued, locale)}</strong></div>
          <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(advances, locale)}</strong></div>
          <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(netPay, locale)}</strong></div>
          <div className="is-margin"><span>{copy.laborMargin}</span><strong>{formatCzk(laborMargin, locale)}</strong></div>
        </div>
        <div className="managerPayrollMobile-hours">
          <span><i className="is-confirmed" /> <b>{formatHours(approvedHours, locale)}</b> {t('payroll.confirmed').toLowerCase()}</span>
          <span><i className="is-pending" /> <b>{formatHours(pendingHours, locale)}</b> {t('payroll.pending').toLowerCase()} · {formatCzk(pending, locale)}</span>
        </div>
      </section>

      <section className="managerPayrollMobile-employees">
        <header>
          <h2>{t('payroll.breakdown')}</h2>
          <button type="button" className="managerPayrollMobile-employeesToggle" aria-expanded={employeesOpen} aria-controls="manager-payroll-employee-list" aria-label={employeesOpen ? copy.hideEmployees : copy.showEmployees} onClick={() => setEmployeesOpen(open => !open)}>
            <svg className="managerPayrollMobile-employeesToggleIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span className="managerPayrollMobile-employeesToggleCount">{employees.length}</span>
            <span className="managerPayrollMobile-employeesToggleLabel">{t('payroll.employees').toLowerCase()}</span>
            <svg className="managerPayrollMobile-employeesToggleChevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </header>
        {employeesOpen ? <div className="managerPayrollMobile-list" id="manager-payroll-employee-list">
          {employees.map(employee => {
            const isSelected = employee.id === selectedEmployeeId;
            const employeeAccrued = accruedAmount(employee.summary);
            return (
              <button type="button" className={`managerPayrollMobile-employee${isSelected ? ' is-selected' : ''}`} key={employee.id} onClick={() => toggleEmployee(employee.id)} aria-pressed={isSelected}>
                <div className="managerPayrollMobile-avatar" aria-hidden="true">{initials(employee.name)}</div>
                <div className="managerPayrollMobile-person"><strong>{employee.name}</strong><span>{ratePair(employee, locale, copy)}</span></div>
                <div className="managerPayrollMobile-rowMoney"><strong>{formatCzk(employee.summary?.netPayCzk, locale)}</strong><span>{copy.marginShort} {formatCzk(employee.summary?.laborMarginCzk, locale)}</span></div>
                <span className="managerPayrollMobile-chevron" aria-hidden="true">{isSelected ? '⌃' : '›'}</span>
                {isSelected ? <div className="managerPayrollMobile-employeeAmounts is-net-pay">
                  <div><span>{copy.accrued}</span><strong>{formatCzk(employeeAccrued, locale)}</strong></div>
                  <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(employee.summary?.advancesCzk, locale)}</strong></div>
                  <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(employee.summary?.netPayCzk, locale)}</strong></div>
                  <div className="is-margin"><span>{copy.laborMargin}</span><strong>{formatCzk(employee.summary?.laborMarginCzk, locale)}</strong></div>
                </div> : null}
              </button>
            );
          })}
        </div> : null}
      </section>
    </div>
  );
}
