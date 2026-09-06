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
  uk: { finance:'Фінанси',week:'Тиждень',month:'Місяць',thisWeek:'Цей тиждень',thisMonth:'Цей місяць',expected:'До виплати',grossExpected:'Нараховано',advances:'Залоги',advanceReceived:'Отримано залогів',remaining:'Залишилось',norm:'год норми',details:'Деталі',calculation:'Розрахунок',confirmed:'Підтверджено',pending:'Очікує підтвердження',overtime:'Понаднормові',total:'Нараховано',netTotal:'Чиста зарплата',rate:'Ставка',hourlyRate:'Поточна погодинна ставка',mixedRates:'Кілька ставок',periodRate:'Ефективна ставка за період',taxNote:'Податки та інші відрахування не враховано',download:'Завантажити звіт PDF',downloading:'Готуємо PDF…',downloadError:'Не вдалося завантажити PDF',share:'Поділитися' },
  cs: { finance:'Finance',week:'Týden',month:'Měsíc',thisWeek:'Tento týden',thisMonth:'Tento měsíc',expected:'K výplatě',grossExpected:'Nárok',advances:'Zálohy',advanceReceived:'Vyplacené zálohy',remaining:'Zbývá',norm:'h normy',details:'Detaily',calculation:'Výpočet',confirmed:'Potvrzeno',pending:'Čeká na potvrzení',overtime:'Přesčas',total:'Nárok',netTotal:'Čistě k výplatě',rate:'Sazba',hourlyRate:'Aktuální hodinová sazba',mixedRates:'Více sazeb',periodRate:'Efektivní sazba za období',taxNote:'Daně a další odvody nejsou zahrnuty',download:'Stáhnout PDF report',downloading:'Připravuji PDF…',downloadError:'PDF se nepodařilo stáhnout',share:'Sdílet' },
  en: { finance:'Finance',week:'Week',month:'Month',thisWeek:'This week',thisMonth:'This month',expected:'Net payable',grossExpected:'Earned',advances:'Advances',advanceReceived:'Advances received',remaining:'Remaining',norm:'h target',details:'Details',calculation:'Calculation',confirmed:'Confirmed',pending:'Pending confirmation',overtime:'Overtime',total:'Earned',netTotal:'Net salary',rate:'Rate',hourlyRate:'Current hourly rate',mixedRates:'Multiple rates',periodRate:'Effective period rate',taxNote:'Taxes and other deductions are not included',download:'Download PDF report',downloading:'Preparing PDF…',downloadError:'Could not download PDF',share:'Share' },
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

export function EmployeeFinanceDashboard({ advances, companyName, hourlyRate, language, locale, localizedStatus, monthData, onChangePeriod, onPeriodChange, period, submission, summary, week, workRules }) {
  const copy = FINANCE_COPY[language] || FINANCE_COPY.uk;
  const [downloadPdf, downloadState] = useDownloadEmployeeFinancePdfMutation();
  const sourceSummary = period === 'month' ? (monthData?.summary || {}) : summary;
  const totalHours = Number(sourceSummary.totalHours || 0);
  const approvedHours = Number(sourceSummary.approvedHours || 0);
  const pendingHours = Number(sourceSummary.pendingHours || 0);
  const confirmedSalary = Number(period === 'month' ? sourceSummary.approvedAmountCzk : sourceSummary.confirmedSalaryCzk || 0);
  const pendingSalary = Number(period === 'month' ? sourceSummary.pendingAmountCzk : sourceSummary.predictedSalaryCzk || 0);
  const earnedSalary = confirmedSalary + pendingSalary;
  const periodAdvances = advancesForPeriod(advances, period, monthData, week);
  const advanceAmount = periodAdvances.reduce((sum, item) => sum + Number(item.amountCzk || 0), 0);
  const expectedSalary = earnedSalary - advanceAmount;
  const currentRate = Number(hourlyRate || 0);
  const effectiveRate = totalHours > 0 ? earnedSalary / totalHours : currentRate;
  const hasMixedRates = totalHours > 0 && Math.abs(effectiveRate - currentRate) >= 0.01;
  const overtimeHours = period === 'month' ? 0 : Number(sourceSummary.overtimeHours || 0);
  const overtimeSalary = overtimeHours * effectiveRate;
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
        language,
        companyName,
        period,
        periodKey: period === 'month' ? monthData?.month : week?.weekStart,
        periodLabel,
        totalHours,
        approvedHours,
        pendingHours,
        confirmedSalary,
        pendingSalary,
        advanceAmount,
        expectedSalary,
        hourlyRate: effectiveRate,
      }).unwrap();
      triggerBlobDownload(blob, `worktrack-payroll-${period === 'month' ? monthData?.month || 'month' : week?.weekStart || 'week'}.pdf`);
    } catch {
      window.alert(copy.downloadError);
    }
  }

  async function handleShare() {
    const payload = { title: copy.finance, text: `${companyName}: ${formatCzk(expectedSalary, locale)}`, url: window.location.href };
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
    <section className="employeeFinance-hero"><div className="employeeFinance-heroTop"><div><span>{copy.expected}</span><strong>{formatCzk(expectedSalary,locale)}</strong><small>{heroRateText}</small></div><span className="employeeFinance-status"><i />{status}</span></div><div className="employeeFinance-progress" aria-label={`${formatHours(totalHours,locale)} / ${formatHours(targetHours,locale)}`}><span style={{width:`${progress}%`}} /></div><div className="employeeFinance-progressMeta"><span>{formatHours(totalHours,locale)} / {formatHours(targetHours,locale)} {copy.norm}</span><span>{copy.remaining} {formatHours(remainingHours,locale)}</span></div></section>
    <section className="employeeFinance-card employeeFinance-calculationCard"><h2>{copy.calculation}</h2><div className="employeeFinance-breakdownRow is-confirmed"><span><i />{copy.confirmed}</span><strong>{formatHours(approvedHours,locale)}</strong><b>{formatCzk(confirmedSalary,locale)}</b></div><div className="employeeFinance-breakdownRow is-pending"><span><i />{copy.pending}</span><strong>{formatHours(pendingHours,locale)}</strong><b>{formatCzk(pendingSalary,locale)}</b></div>{period==='week'&&overtimeHours>0?<div className="employeeFinance-breakdownRow is-overtime"><span><i />{copy.overtime}</span><strong>{formatHours(overtimeHours,locale)}</strong><b>{formatCzk(overtimeSalary,locale)}</b></div>:null}<div className="employeeFinance-breakdownRow is-advance"><span>{copy.advances}</span><strong></strong><b>− {formatCzk(advanceAmount,locale)}</b></div><div className="employeeFinance-totalRow is-net"><span>{copy.netTotal}</span><strong></strong><b>{formatCzk(expectedSalary,locale)}</b></div></section>
    <section className="employeeFinance-card employeeFinance-rateCard"><div className="employeeFinance-taxNote"><span aria-hidden="true">ⓘ</span>{copy.taxNote}</div></section>
    <div className="employeeFinance-actions"><button className="employeeFinance-primaryAction" type="button" disabled={downloadState.isLoading} onClick={handleDownloadPdf}><span aria-hidden="true">⇩</span>{downloadState.isLoading ? copy.downloading : copy.download}</button><button className="employeeFinance-secondaryAction" type="button" onClick={handleShare}><span aria-hidden="true">⇧</span>{copy.share}</button></div>
  </div>;
}
