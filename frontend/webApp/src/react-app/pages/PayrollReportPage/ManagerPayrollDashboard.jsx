import { useMemo, useState } from 'react';

import { formatCzk, formatHours } from '../../app/formatters.js';
import './ManagerPayrollAdvances.css';
import './ManagerPayrollEmployeesToggle.css';

const COPY = {
  uk: { noEarnings: 'Без нарахувань', customer: 'Від замовника', employeePay: 'До виплати', table: 'У таблиці', approved: 'Погоджено', waiting: 'Очікує', managerHours: 'Години з таблиці', preliminary: 'Попередній дохід', revenue: 'Повна сума за працівника', totalRevenue: 'Повна сума за роботи для клієнтів', accrued: 'Нараховано працівнику', advances: 'Залоги', netPay: 'До виплати', laborMargin: 'Дохід компанії', netPayShort: 'до виплати', multipleRates: 'Кілька ставок', rateUnit: 'Kč/год', showEmployees: 'Показати працівників', hideEmployees: 'Згорнути працівників' },
  cs: { noEarnings: 'Bez částek', customer: 'Od zákazníka', employeePay: 'Zaměstnanci k výplatě', table: 'V tabulce', approved: 'Schváleno', waiting: 'Čeká', managerHours: 'Hodiny z tabulky', preliminary: 'Předběžný výnos', revenue: 'Celková částka za zaměstnance', totalRevenue: 'Celková částka za všechny zaměstnance', accrued: 'Nárok zaměstnance', advances: 'Zálohy', netPay: 'K výplatě', laborMargin: 'Výnos společnosti', netPayShort: 'k výplatě', multipleRates: 'Více sazeb', rateUnit: 'Kč/h', showEmployees: 'Zobrazit zaměstnance', hideEmployees: 'Sbalit zaměstnance' },
  en: { noEarnings: 'No earnings', customer: 'From customer', employeePay: 'Employee net pay', table: 'Timesheet', approved: 'Approved', waiting: 'Pending', managerHours: 'Timesheet hours', preliminary: 'Provisional margin', revenue: 'Total amount for employee', totalRevenue: 'Total amount for all employees', accrued: 'Employee earnings', advances: 'Advances', netPay: 'Net pay', laborMargin: 'Company margin', netPayShort: 'net pay', multipleRates: 'Multiple rates', rateUnit: 'CZK/h', showEmployees: 'Show employees', hideEmployees: 'Collapse employees' },
};

function copyForLocale(locale = '') {
  const key = String(locale).toLowerCase().startsWith('cs') ? 'cs' : String(locale).toLowerCase().startsWith('en') ? 'en' : 'uk';
  return COPY[key];
}

function initials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '—';
}

function EmployeeAvatar({ employee }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = employee.avatarDataUrl;
  return <div className="managerPayrollMobile-avatar" aria-hidden="true">{source && failedSource !== source ? <img src={source} alt="" loading="lazy" onError={() => setFailedSource(source)} /> : initials(employee.name)}</div>;
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
  const [showZeroEmployees, setShowZeroEmployees] = useState(false);
  const sortedEmployees = useMemo(() => [...employees].sort((a, b) => {
    const revenue = employee => Number(employee.summary?.revenueCzk ?? (accruedAmount(employee.summary) + Number(employee.summary?.laborMarginCzk || 0)));
    return revenue(b) - revenue(a) || a.name.localeCompare(b.name, locale);
  }), [employees, locale]);
  const visibleSummary = summary;
  const copy = copyForLocale(locale);
  const hours = value => String(locale).startsWith('uk') ? formatHours(value, locale).replace(/h$/, 'год') : formatHours(value, locale);
  const accrued = accruedAmount(visibleSummary);
  const revenue = Number(visibleSummary?.revenueCzk ?? (accrued + Number(visibleSummary?.laborMarginCzk || 0)));
  const advances = Number(visibleSummary?.advancesCzk || 0);
  const netPay = Number(visibleSummary?.netPayCzk ?? Math.max(accrued - advances, 0));
  const laborMargin = Number(visibleSummary?.laborMarginCzk || 0);
  const pending = Number(visibleSummary?.predictedSalaryCzk || 0);
  const approvedHours = visibleSummary?.approvedHours || 0;
  const pendingHours = visibleSummary?.pendingHours || 0;

  const hasAmounts = employee => ['revenueCzk', 'accruedSalaryCzk', 'netPayCzk', 'advancesCzk', 'predictedSalaryCzk'].some(key => Number(employee.summary?.[key] || 0) !== 0) || Number(employee.summary?.managerHours || 0) !== 0 || Number(employee.summary?.totalHours || 0) !== 0;
  const zeroEmployees = sortedEmployees.filter(employee => !hasAmounts(employee));
  const visibleEmployees = sortedEmployees.filter(employee => showZeroEmployees || hasAmounts(employee));

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
          <span>{copy.managerHours}: <b>{hours(visibleSummary.managerHours)}</b></span>
          <span><i className="is-confirmed" /> <b>{hours(approvedHours)}</b> {t('payroll.confirmed').toLowerCase()}</span>
          <span><i className="is-pending" /> <b>{hours(pendingHours)}</b> {t('payroll.pending').toLowerCase()} · {formatCzk(pending, locale)}</span>
        </div>
      </section>

      <section className="managerPayrollMobile-employees">
        <header>
          <h2>{t('payroll.employees')} · {employees.length}</h2>
          <button type="button" className="managerPayrollMobile-employeesToggle" aria-expanded={employeesOpen} aria-controls="manager-payroll-employee-list" aria-label={employeesOpen ? copy.hideEmployees : copy.showEmployees} onClick={() => setEmployeesOpen(open => !open)}>
            <svg className="managerPayrollMobile-employeesToggleIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            
            <span className="managerPayrollMobile-employeesToggleLabel">{employeesOpen ? copy.hideEmployees : copy.showEmployees}</span>
            <svg className="managerPayrollMobile-employeesToggleChevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </header>
        {employeesOpen ? <div className="managerPayrollMobile-list" id="manager-payroll-employee-list">
          {visibleEmployees.map(employee => {
            const isSelected = employee.id === selectedEmployeeId;
            const employeeAccrued = accruedAmount(employee.summary);
            const employeeRevenue = Number(employee.summary?.revenueCzk ?? (employeeAccrued + Number(employee.summary?.laborMarginCzk || 0)));
            const employeeNetPay = Number(employee.summary?.netPayCzk ?? Math.max(employeeAccrued - Number(employee.summary?.advancesCzk || 0), 0));
            return (
              <button type="button" className={`managerPayrollMobile-employee${isSelected ? ' is-selected' : ''}`} key={employee.id} onClick={() => toggleEmployee(employee.id)} aria-expanded={isSelected}>
                <EmployeeAvatar employee={employee} />
                <div className="managerPayrollMobile-person"><strong>{employee.name}</strong></div>
                <div className="managerPayrollMobile-rowMoney"><div><span>{copy.customer}</span><strong>{formatCzk(employeeRevenue, locale)}</strong></div><div className="is-net"><span>{copy.employeePay}</span><strong>{formatCzk(employeeNetPay, locale)}</strong></div></div>
                <span className="managerPayrollMobile-chevron" aria-hidden="true">{isSelected ? '⌃' : '›'}</span>
                {isSelected ? <div className="managerPayrollMobile-employeeAmounts is-net-pay">
                  <div className="managerPayrollMobile-rateDetail"><span>{t('payroll.rate')}</span><strong>{ratePair(employee, locale, copy)}</strong></div>
                  <div><span>{copy.accrued}</span><strong>{formatCzk(employeeAccrued, locale)}</strong></div>
                  <div className="is-advance"><span>{copy.advances}</span><strong>− {formatCzk(employee.summary?.advancesCzk, locale)}</strong></div>
                  <div className="is-margin"><span>{employee.summary?.marginIsPreliminary ? copy.preliminary : copy.laborMargin}</span><strong>{formatCzk(employee.summary?.laborMarginCzk, locale)}</strong></div>
                  <div className="managerPayrollMobile-detailHours">{[[copy.table, employee.summary?.managerHours], [copy.approved, employee.summary?.approvedHours], [copy.waiting, employee.summary?.pendingHours]].map(([label, value], index) => <div key={label} className={`hourStat hourStat-${index}`}><span>{label}</span><strong>{hours(value)}</strong></div>)}</div>
                </div> : null}
              </button>
            );
          })}
          {zeroEmployees.length > 0 ? <button type="button" className="managerPayrollMobile-zeroToggle" aria-expanded={showZeroEmployees} onClick={() => setShowZeroEmployees(value => !value)}>{copy.noEarnings} · {zeroEmployees.length}<span aria-hidden="true">{showZeroEmployees ? '⌃' : '⌄'}</span></button> : null}
        </div> : null}
      </section>
    </div>
  );
}
