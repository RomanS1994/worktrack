import { useNavigate } from 'react-router-dom';

import {
  businessDaysInMonth,
  formatCzk,
  formatHours,
  formatMonthPeriod,
  formatPeriod,
} from '../../app/formatters.js';

const FINANCE_COPY = {
  uk: { finance:'Фінанси',week:'Тиждень',month:'Місяць',thisWeek:'Цей тиждень',thisMonth:'Цей місяць',expected:'Очікувана зарплата',remaining:'Залишилось',norm:'год норми',details:'Деталі',calculation:'Розрахунок',confirmed:'Підтверджено',pending:'Очікує підтвердження',overtime:'Понаднормові',total:'Всього',rate:'Ставка',hourlyRate:'Погодинна ставка',taxNote:'Податки та відрахування не враховано',download:'Завантажити звіт PDF',share:'Поділитися',help:'Довідка' },
  cs: { finance:'Finance',week:'Týden',month:'Měsíc',thisWeek:'Tento týden',thisMonth:'Tento měsíc',expected:'Očekávaná mzda',remaining:'Zbývá',norm:'h normy',details:'Detaily',calculation:'Výpočet',confirmed:'Potvrzeno',pending:'Čeká na potvrzení',overtime:'Přesčas',total:'Celkem',rate:'Sazba',hourlyRate:'Hodinová sazba',taxNote:'Daně a odvody nejsou zahrnuty',download:'Stáhnout PDF report',share:'Sdílet',help:'Nápověda' },
  en: { finance:'Finance',week:'Week',month:'Month',thisWeek:'This week',thisMonth:'This month',expected:'Expected salary',remaining:'Remaining',norm:'h target',details:'Details',calculation:'Calculation',confirmed:'Confirmed',pending:'Pending confirmation',overtime:'Overtime',total:'Total',rate:'Rate',hourlyRate:'Hourly rate',taxNote:'Taxes and deductions are not included',download:'Download PDF report',share:'Share',help:'Help' },
};

function employeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || '—';
}

export function EmployeeFinanceDashboard({ companyName, hourlyRate, language, locale, localizedStatus, monthData, onChangePeriod, onPeriodChange, period, submission, summary, user, week, workRules }) {
  const navigate = useNavigate();
  const copy = FINANCE_COPY[language] || FINANCE_COPY.uk;
  const sourceSummary = period === 'month' ? (monthData?.summary || {}) : summary;
  const totalHours = Number(sourceSummary.totalHours || 0);
  const approvedHours = Number(sourceSummary.approvedHours || 0);
  const pendingHours = Number(sourceSummary.pendingHours || 0);
  const confirmedSalary = Number(period === 'month' ? sourceSummary.approvedAmountCzk : sourceSummary.confirmedSalaryCzk || 0);
  const pendingSalary = Number(period === 'month' ? sourceSummary.pendingAmountCzk : sourceSummary.predictedSalaryCzk || 0);
  const expectedSalary = confirmedSalary + pendingSalary;
  const overtimeHours = period === 'month' ? 0 : Number(sourceSummary.overtimeHours || 0);
  const overtimeSalary = overtimeHours * Number(hourlyRate || 0);
  const status = period === 'month' ? copy.thisMonth : localizedStatus(submission?.status);
  const dailyTarget = Math.max(0.25, Number(workRules?.standardDailyHours || 8));
  const monthDays = businessDaysInMonth(monthData?.month);
  const targetHours = period === 'month' ? dailyTarget * (monthDays || 20) : dailyTarget * 5;
  const remainingHours = Math.max(targetHours - totalHours, 0);
  const progress = targetHours > 0 ? Math.min((totalHours / targetHours) * 100, 100) : 0;
  const periodLabel = period === 'month' ? formatMonthPeriod(monthData?.month, locale) : formatPeriod(week?.weekStart, week?.weekEnd, locale);

  async function handleShare() {
    const payload = { title: copy.finance, text: `${companyName}: ${formatCzk(expectedSalary, locale)}`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { return; }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  return <div className="employeeFinance noPrint">
    <header className="employeeFinance-heading"><h1>{copy.finance}</h1><button className="employeeFinance-helpButton" type="button" aria-label={copy.help} title={copy.help}>?</button></header>
    <div className="employeeFinance-tabs" role="tablist" aria-label={copy.finance}><button className={period==='week'?'is-active':''} type="button" role="tab" aria-selected={period==='week'} onClick={()=>onPeriodChange('week')}>{copy.week}</button><button className={period==='month'?'is-active':''} type="button" role="tab" aria-selected={period==='month'} onClick={()=>onPeriodChange('month')}>{copy.month}</button></div>
    <section className="employeeFinance-periodNav" aria-label={period==='month'?copy.month:copy.week}><button type="button" onClick={()=>onChangePeriod(-1)} aria-label="Previous period">‹</button><div><strong>{periodLabel}</strong><span>{period==='month'?copy.thisMonth:copy.thisWeek}</span></div><button type="button" onClick={()=>onChangePeriod(1)} aria-label="Next period">›</button></section>
    <section className="employeeFinance-hero"><div className="employeeFinance-heroTop"><div><span>{copy.expected}</span><strong>{formatCzk(expectedSalary,locale)}</strong><small>{formatHours(totalHours,locale)} × {formatCzk(hourlyRate,locale)}</small></div><span className="employeeFinance-status"><i />{status}</span></div><div className="employeeFinance-progress" aria-label={`${formatHours(totalHours,locale)} / ${formatHours(targetHours,locale)}`}><span style={{width:`${progress}%`}} /></div><div className="employeeFinance-progressMeta"><span>{formatHours(totalHours,locale)} / {formatHours(targetHours,locale)} {copy.norm}</span><span>{copy.remaining} {formatHours(remainingHours,locale)}</span></div></section>
    <section className="employeeFinance-companyCard"><div className="employeeFinance-icon" aria-hidden="true">▦</div><div className="employeeFinance-companyText"><strong>{companyName}</strong><span>{employeeName(user)} · {formatCzk(hourlyRate,locale)}/год</span></div><button className="employeeFinance-detailsButton" type="button" onClick={()=>navigate('/profile')}>{copy.details}<span aria-hidden="true">›</span></button></section>
    <section className="employeeFinance-card employeeFinance-calculationCard"><h2>{copy.calculation}</h2><div className="employeeFinance-breakdownRow is-confirmed"><span><i />{copy.confirmed}</span><strong>{formatHours(approvedHours,locale)}</strong><b>{formatCzk(confirmedSalary,locale)}</b></div><div className="employeeFinance-breakdownRow is-pending"><span><i />{copy.pending}</span><strong>{formatHours(pendingHours,locale)}</strong><b>{formatCzk(pendingSalary,locale)}</b></div>{period==='week'?<div className="employeeFinance-breakdownRow is-overtime"><span><i />{copy.overtime}</span><strong>{formatHours(overtimeHours,locale)}</strong><b>{formatCzk(overtimeSalary,locale)}</b></div>:null}<div className="employeeFinance-totalRow"><span>{copy.total}</span><strong>{formatHours(totalHours,locale)}</strong><b>{formatCzk(expectedSalary,locale)}</b></div></section>
    <section className="employeeFinance-card employeeFinance-rateCard"><div className="employeeFinance-rateLine"><div className="employeeFinance-rateIcon" aria-hidden="true">₭</div><div><strong>{copy.rate}</strong><span>{copy.hourlyRate}</span></div><b>{formatCzk(hourlyRate,locale)}/год</b></div><div className="employeeFinance-taxNote"><span aria-hidden="true">ⓘ</span>{copy.taxNote}</div></section>
    <div className="employeeFinance-actions"><button className="employeeFinance-primaryAction" type="button" onClick={()=>window.print()}><span aria-hidden="true">⇩</span>{copy.download}</button><button className="employeeFinance-secondaryAction" type="button" onClick={handleShare}><span aria-hidden="true">⇧</span>{copy.share}</button></div>
  </div>;
}
