import {
  businessDaysInMonth,
  formatCzk,
  formatHours,
  formatMonthPeriod,
  formatPeriod,
} from '../../app/formatters.js';
import { useDownloadEmployeeFinancePdfMutation } from '../../features/worktrack/employeeFinancePdfApi.js';
import './EmployeeFinanceCompact.css';

const FINANCE_COPY = {
  uk: { finance:'Фінанси',week:'Тиждень',month:'Місяць',thisWeek:'Цей тиждень',thisMonth:'Цей місяць',expected:'До виплати',recorded:'За всі записані години',estimate:'Попередній розрахунок',advances:'Залоги',remaining:'Залишилось',norm:'год норми',calculation:'Розрахунок',confirmed:'Підтверджено',pending:'Очікує підтвердження',draft:'Ще не подано',recordedTotal:'Разом за записані години',payable:'До виплати',payableNote:'Після підтвердження та вирахування авансів',pendingNote:'Непідтверджені години — попередній розрахунок. До виплати вони потраплять після погодження менеджером.',mixedRates:'Кілька ставок',taxNote:'Податки та інші відрахування не враховано',download:'Завантажити звіт PDF',downloading:'Готуємо PDF…',downloadError:'Не вдалося завантажити PDF',share:'Поділитися' },
  cs: { finance:'Finance',week:'Týden',month:'Měsíc',thisWeek:'Tento týden',thisMonth:'Tento měsíc',expected:'K výplatě',recorded:'Za všechny zapsané hodiny',estimate:'Předběžný výpočet',advances:'Zálohy',remaining:'Zbývá',norm:'h normy',calculation:'Výpočet',confirmed:'Potvrzeno',pending:'Čeká na potvrzení',draft:'Dosud neodesláno',recordedTotal:'Celkem za zapsané hodiny',payable:'K výplatě',payableNote:'Po schválení a odečtení záloh',pendingNote:'Neschválené hodiny jsou předběžný výpočet. K výplatě se přičtou po schválení vedoucím.',mixedRates:'Více sazeb',taxNote:'Daně a další odvody nejsou zahrnuty',download:'Stáhnout PDF report',downloading:'Připravuji PDF…',downloadError:'PDF se nepodařilo stáhnout',share:'Sdílet' },
  en: { finance:'Finance',week:'Week',month:'Month',thisWeek:'This week',thisMonth:'This month',expected:'Net payable',recorded:'For all recorded hours',estimate:'Estimated amount',advances:'Advances',remaining:'Remaining',norm:'h target',calculation:'Calculation',confirmed:'Approved',pending:'Awaiting approval',draft:'Not submitted yet',recordedTotal:'Total recorded earnings',payable:'Net payable',payableNote:'After approval and advances',pendingNote:'Unapproved hours are estimates. They become payable after manager approval.',mixedRates:'Multiple rates',taxNote:'Taxes and other deductions are not included',download:'Download PDF report',downloading:'Preparing PDF…',downloadError:'Could not download PDF',share:'Share' },
};

function advancesForPeriod(advances, period, monthData, week) {
  const list = Array.isArray(advances) ? advances : [];
  if (period === 'month') {
    const month = monthData?.month;
    return month ? list.filter(item => String(item.paidAt || '').startsWith(month)) : [];
  }
  const start = week?.weekStart;
  const end = week?.weekEnd;
  if (!start || !end) return [];
  return list.filter(item => item.paidAt >= start && item.paidAt <= end);
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EmployeeFinanceDashboard({ advances, companyName, hourlyRate, language, locale, localizedStatus, monthData, onChangePeriod, onPeriodChange, period, submission, summary, week, weekEntries, workRules }) {
  const copy = FINANCE_COPY[language] || FINANCE_COPY.uk;
  const [downloadPdf, downloadState] = useDownloadEmployeeFinancePdfMutation();
  const sourceSummary = period === 'month' ? (monthData?.summary || {}) : summary;
  const totalHours = Number(sourceSummary.totalHours || 0);
  const approvedHours = Number(sourceSummary.approvedHours || 0);
  const pendingHours = Number(sourceSummary.pendingHours || 0);
  const confirmedSalary = Number(period === 'month' ? sourceSummary.approvedAmountCzk : sourceSummary.confirmedSalaryCzk || 0);
  const pendingSalary = Number(period === 'month' ? sourceSummary.pendingAmountCzk : sourceSummary.predictedSalaryCzk || 0);
  const earnedSalary = confirmedSalary + pendingSalary;
  const currentRate = Number(hourlyRate || 0);
  // Weekly totals use the same net hours and rate snapshots as the weekly summary.
  const draftEntries = period === 'week' && Array.isArray(weekEntries) ? weekEntries.filter(entry => entry.status === 'DRAFT') : [];
  const draftHours = period === 'month' ? Number(sourceSummary.draftHours || 0) : draftEntries.reduce((sum, entry) => sum + Number(entry.netHours ?? entry.hours ?? 0), 0);
  const draftSalary = period === 'month' ? Number(sourceSummary.draftAmountCzk || 0) : draftEntries.reduce((sum, entry) => sum + Math.round(Number(entry.netHours ?? entry.hours ?? 0) * Number(entry.hourlyRateCzk ?? currentRate) * 100) / 100, 0);
  const submittedHours = period === 'month' ? Number(sourceSummary.submittedHours || 0) : Math.max(0, pendingHours - draftHours);
  const submittedSalary = period === 'month' ? Number(sourceSummary.submittedAmountCzk || 0) : pendingSalary - draftSalary;
  const periodAdvances = advancesForPeriod(advances, period, monthData, week);
  const advanceAmount = periodAdvances.reduce((sum, item) => sum + Number(item.amountCzk || 0), 0);
  const payableSalary = confirmedSalary - advanceAmount;
  const effectiveRate = totalHours > 0 ? earnedSalary / totalHours : currentRate;
  const hasMixedRates = totalHours > 0 && Math.abs(effectiveRate - currentRate) >= 0.01;
  const status = period === 'month' ? copy.thisMonth : localizedStatus(submission?.status);
  const dailyTarget = Math.max(0.25, Number(workRules?.standardDailyHours || 8));
  const monthDays = businessDaysInMonth(monthData?.month);
  const targetHours = period === 'month' ? dailyTarget * (monthDays || 20) : dailyTarget * 5;
  const remainingHours = Math.max(targetHours - totalHours, 0);
  const progress = targetHours > 0 ? Math.min((totalHours / targetHours) * 100, 100) : 0;
  const periodLabel = period === 'month' ? formatMonthPeriod(monthData?.month, locale) : formatPeriod(week?.weekStart, week?.weekEnd, locale);
  const heroRateText = hasMixedRates
    ? `${formatHours(totalHours, locale)} · ${copy.mixedRates}`
    : `${formatHours(totalHours, locale)} × ${formatCzk(currentRate, locale)}`;

  async function handleDownloadPdf() {
    if (downloadState.isLoading) return;
    try {
      const blob = await downloadPdf({
        language, companyName, period,
        periodKey: period === 'month' ? monthData?.month : week?.weekStart,
        periodLabel, totalHours, approvedHours, pendingHours,
        confirmedSalary, pendingSalary, advanceAmount,
        expectedSalary: payableSalary, hourlyRate: effectiveRate,
      }).unwrap();
      triggerBlobDownload(blob, `worktrack-payroll-${period === 'month' ? monthData?.month || 'month' : week?.weekStart || 'week'}.pdf`);
    } catch {
      window.alert(copy.downloadError);
    }
  }

  async function handleShare() {
    const payload = { title: copy.finance, text: `${companyName}: ${formatCzk(payableSalary, locale)}`, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(payload); } catch { return; }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  return <div className="employeeFinance noPrint">
    <header className="employeeFinance-heading"><h1>{copy.finance}</h1></header>
    <div className="employeeFinance-tabs" role="tablist" aria-label={copy.finance}><button className={period==='month'?'is-active':''} type="button" role="tab" aria-selected={period==='month'} onClick={()=>onPeriodChange('month')}>{copy.month}</button><button className={period==='week'?'is-active':''} type="button" role="tab" aria-selected={period==='week'} onClick={()=>onPeriodChange('week')}>{copy.week}</button></div>
    <section className="employeeFinance-periodNav" aria-label={period==='month'?copy.month:copy.week}><button type="button" onClick={()=>onChangePeriod(-1)} aria-label="Previous period">‹</button><div><strong>{periodLabel}</strong><span>{period==='month'?copy.thisMonth:copy.thisWeek}</span></div><button type="button" onClick={()=>onChangePeriod(1)} aria-label="Next period">›</button></section>
    <section className="employeeFinance-hero"><div className="employeeFinance-heroTop"><div><span>{copy.recorded}</span><strong>{formatCzk(earnedSalary,locale)}</strong><small>{heroRateText} · {copy.estimate}</small></div><span className="employeeFinance-status"><i />{status}</span></div><div className="employeeFinance-progress" aria-label={`${formatHours(totalHours,locale)} / ${formatHours(targetHours,locale)}`}><span style={{width:`${progress}%`}} /></div><div className="employeeFinance-progressMeta"><span>{formatHours(totalHours,locale)} / {formatHours(targetHours,locale)} {copy.norm}</span><span>{copy.remaining} {formatHours(remainingHours,locale)}</span></div></section>
    <section className="employeeFinance-card employeeFinance-calculationCard"><h2>{copy.calculation}</h2><div className="employeeFinance-statusRow is-confirmed"><span className="employeeFinance-statusDot"/><div><span>{copy.confirmed}</span><small>{formatHours(approvedHours,locale)}</small></div><strong>{formatCzk(confirmedSalary,locale)}</strong></div><div className="employeeFinance-statusRow is-pending"><span className="employeeFinance-statusDot"/><div><span>{copy.pending}</span><small>{formatHours(submittedHours,locale)}</small></div><strong>{formatCzk(submittedSalary,locale)}</strong></div><div className="employeeFinance-statusRow is-draft"><span className="employeeFinance-statusDot"/><div><span>{copy.draft}</span><small>{formatHours(draftHours,locale)}</small></div><strong>{formatCzk(draftSalary,locale)}</strong></div><div className="employeeFinance-recordedTotal"><span>{copy.recordedTotal}</span><strong>{formatCzk(earnedSalary,locale)}</strong></div>{advanceAmount>0?<div className="employeeFinance-advanceLine"><span>{copy.advances}</span><strong>− {formatCzk(advanceAmount,locale)}</strong></div>:null}<div className="employeeFinance-payable"><div><span>{copy.payable}</span><small>{copy.payableNote}</small></div><strong>{formatCzk(payableSalary,locale)}</strong></div></section>
    <section className="employeeFinance-card employeeFinance-rateCard"><div className="employeeFinance-taxNote"><span aria-hidden="true">ⓘ</span>{copy.pendingNote} {copy.taxNote}</div></section>
    <div className="employeeFinance-actions"><button className="employeeFinance-primaryAction" type="button" disabled={downloadState.isLoading} onClick={handleDownloadPdf}><span aria-hidden="true">⇩</span>{downloadState.isLoading ? copy.downloading : copy.download}</button><button className="employeeFinance-secondaryAction" type="button" onClick={handleShare}><span aria-hidden="true">⇧</span>{copy.share}</button></div>
  </div>;
}
