import { useMemo, useState } from 'react';

import { formatCzk, formatHours } from '../../app/formatters.js';
import './ManagerPayrollAdvances.css';
import './ManagerPayrollEmployeesToggle.css';

const COPY = {
  uk: { managerHours: 'Години з таблиці', preliminary: 'Попередній дохід', revenue: 'Повна сума за працівника', totalRevenue: 'Повна сума за роботи для клієнтів', accrued: 'Нараховано працівнику', advances: 'Залоги', netPay: 'До виплати', laborMargin: 'Дохід компанії', netPayShort: 'до виплати', multipleRates: 'Кілька ставок', rateUnit: 'Kč/год', showEmployees: 'Показати працівників', hideEmployees: 'Згорнути працівників' },
  cs: { managerHours: 'Hodiny z tabulky', preliminary: 'Předběžný výnos', revenue: 'Celková částka za zaměstnance', totalRevenue: 'Celková částka za všechny zaměstnance', accrued: 'Nárok zaměstnance', advances: 'Zálohy', netPay: 'K výplatě', laborMargin: 'Výnos společnosti', netPayShort: 'k výplatě', multipleRates: 'Více sazeb', rateUnit: 'Kč/h', showEmployees: 'Zobrazit zaměstnance', hideEmployees: 'Sbalit zaměstnance' },
  en: { managerHours: 'Timesheet hours', preliminary: 'Provisional margin', revenue: 'Total amount for employee', totalRevenue: 'Total amount for all employees', accrued: 'Employee earnings', advances: 'Advances', netPay: 'Net pay', laborMargin: 'Company margin', netPayShort: 'net pay', multipleRates: 'Multiple rates', rateUnit: 'CZK/h', showEmployees: 'Show employees', hideEmployees: 'Collapse employees' },
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
  const number = value => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value || 0));
  return `${number(payRate)}${Number(payRate) === Number(customerRate) ? '' : ` → ${number(customerRate)}`} ${copy.rateUnit}`;
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
  const sortedEmployees = useMemo(() => [...employees].sort((a, b) => {
    const revenue = employee => Number(employee.summary?.revenueCzk ?? (accruedAmount(employee.summary) + Number(employee.summary?.laborMarginCzk || 0)));
    return revenue(b) - revenue(a) || a.name.localeCompare(b.name, locale);
  }), [employees, locale]);
  const visibleSummary = summary;
  const copy = copyForLocale(locale);
  const accrued = accruedAmount(visibleSummary);
  const revenue = Number(visibleSummary?.revenueCzk ?? (accrued + Number(visibleSummary?.laborMarginCzk || 0)));
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
        <span className="managerPayrollMobile-eyebrow">{copy.totalRevenue}</span>
        <strong className="managerPayrollMobile-total">{formatCzk(revenue, locale)}</strong>
        <div className="managerPayrollMobile-moneyGrid is-net-pay">
          <div className="is-net"><span>{copy.netPay}</span><strong>{formatCzk(netPay, locale)}</strong></div>
          <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(advances, locale)}</strong></div>
          <div className="is-margin"><span>{visibleSummary.marginIsPreliminary ? copy.preliminary : copy.laborMargin}</span><strong>{formatCzk(laborMargin, locale)}</strong></div>
        </div>
        <div className="managerPayrollMobile-hours">
          <span>{copy.managerHours}: <b>{formatHours(visibleSummary.managerHours, locale)}</b></span>
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
          {sortedEmployees.map(employee => {
            const isSelected = employee.id === selectedEmployeeId;
            const employeeAccrued = accruedAmount(employee.summary);
            const employeeRevenue = Number(employee.summary?.revenueCzk ?? (employeeAccrued + Number(employee.summary?.laborMarginCzk || 0)));
            const employeeNetPay = Number(employee.summary?.netPayCzk ?? Math.max(employeeAccrued - Number(employee.summary?.advancesCzk || 0), 0));
            return (
              <button type="button" className={`managerPayrollMobile-employee${isSelected ? ' is-selected' : ''}`} key={employee.id} onClick={() => toggleEmployee(employee.id)} aria-expanded={isSelected}>
                <div className="managerPayrollMobile-avatar" aria-hidden="true">{initials(employee.name)}</div>
                <div className="managerPayrollMobile-person"><strong>{employee.name}</strong><span>{ratePair(employee, locale, copy)}</span></div>
                <div className="managerPayrollMobile-rowMoney"><strong>{formatCzk(employeeRevenue, locale)}</strong><span>{copy.netPayShort}: {formatCzk(employeeNetPay, locale)}</span></div>
                <span className="managerPayrollMobile-chevron" aria-hidden="true">{isSelected ? '⌃' : '›'}</span>
                {isSelected ? <div className="managerPayrollMobile-employeeAmounts is-net-pay">
                  <div><span>{copy.accrued}</span><strong>{formatCzk(employeeAccrued, locale)}</strong></div>
                  <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(employee.summary?.advancesCzk, locale)}</strong></div>
                  <div className="is-margin"><span>{employee.summary?.marginIsPreliminary ? copy.preliminary : copy.laborMargin}</span><strong>{formatCzk(employee.summary?.laborMarginCzk, locale)}</strong></div>
                  <div className="managerPayrollMobile-detailHours"><span>{copy.managerHours}: {formatHours(employee.summary?.managerHours, locale)} · {t('payroll.approvedHours')}: {formatHours(employee.summary?.approvedHours, locale)} · {t('payroll.pendingHours')}: {formatHours(employee.summary?.pendingHours, locale)}</span></div>
                </div> : null}
              </button>
            );
          })}
        </div> : null}
      </section>
    </div>
  );
}
