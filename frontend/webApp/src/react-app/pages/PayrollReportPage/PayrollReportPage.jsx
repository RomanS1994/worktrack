import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { useCabinetMode } from '@shared/features/auth/cabinetMode.js';
import { formatCzk, formatHours, formatMonthPeriod, formatPeriod, getEmployeeName, getLocalDateKey, monthKeyFromAnchor, resolveLocale, shiftAnchor } from '../../app/formatters.js';
import { useGetMonthlyHoursQuery } from '../../features/worktrack/monthlyHoursApi.js';
import { useGetEmployeeAdvancesQuery, useGetManagerPayrollQuery, useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import { ManagerAdvancesPage } from '../ManagerAdvancesPage/ManagerAdvancesPage.jsx';
import { EmployeeFinanceDashboard } from './EmployeeFinanceDashboard.jsx';
import { ManagerPayrollDashboard } from './ManagerPayrollDashboard.jsx';
import './PayrollReportPage.css';
import './ManagerPayrollMobile.css';

const STATUS_KEYS = { DRAFT:'draft',SUBMITTED:'submitted',APPROVED:'approved',REJECTED:'rejected' };
const MIXED_RATE_LABELS = { uk:'Кілька ставок',cs:'Více sazeb',en:'Multiple rates' };

function ReportRow({label,value,emphasize=false}) {
  return <div className={`payrollReport-row${emphasize?' is-emphasized':''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function periodAdvances(advances, period, monthData, week) {
  const list = Array.isArray(advances) ? advances : [];
  if (period === 'month') return list.filter(item => String(item.paidAt || '').startsWith(monthData?.month || ''));
  if (!week?.weekStart || !week?.weekEnd) return [];
  return list.filter(item => item.paidAt >= week.weekStart && item.paidAt <= week.weekEnd);
}

export function PayrollReportPage() {
  const { language, t } = useI18n();
  const locale = resolveLocale(language);
  const user = useSelector(selectUser);
  const cabinetMode = useCabinetMode(user);
  const isManager = cabinetMode === 'manager';
  const [managerPeriod,setManagerPeriod] = useState('month');
  const [managerAnchor,setManagerAnchor] = useState(getLocalDateKey);
  const [employeePeriod,setEmployeePeriod] = useState('month');
  const [employeeAnchor,setEmployeeAnchor] = useState(getLocalDateKey);

  const workSummaryQuery = useGetWorkSummaryQuery({weekStart:employeeAnchor,cabinet:'employee'},{skip:isManager||employeePeriod!=='week'});
  const monthlyHoursQuery = useGetMonthlyHoursQuery(monthKeyFromAnchor(employeeAnchor),{skip:isManager||employeePeriod!=='month'});
  const managerPayrollQuery = useGetManagerPayrollQuery({period:managerPeriod,anchor:managerAnchor},{skip:!isManager});
  const employeeAdvancesQuery = useGetEmployeeAdvancesQuery({}, { skip:isManager });
  const activeQuery = isManager ? managerPayrollQuery : employeePeriod==='month' ? monthlyHoursQuery : workSummaryQuery;
  const data = activeQuery.data;
  const error = activeQuery.error;
  const isLoading = activeQuery.isLoading || activeQuery.isFetching;
  const summary = data?.summary || {};
  const companyName = data?.company?.name || user?.activeCompany?.name || 'WorkTrack';
  const week = employeePeriod==='week' ? data?.week || null : null;
  const submission = employeePeriod==='week' ? data?.submission || null : null;
  const hourlyRate = data?.hourlyRateCzk || user?.activeMembership?.hourlyRateCzk || '0.00';
  const managerEmployees = Array.isArray(data?.employees) ? data.employees : [];
  const employeeAdvances = Array.isArray(employeeAdvancesQuery.data?.advances) ? employeeAdvancesQuery.data.advances : [];
  const visibleAdvances = periodAdvances(employeeAdvances, employeePeriod, employeePeriod==='month'?data:null, week);
  const advanceTotal = visibleAdvances.reduce((sum,item)=>sum+Number(item.amountCzk||0),0);
  const employeeEarned = employeePeriod==='month'
    ? Number(summary.approvedAmountCzk||0)+Number(summary.pendingAmountCzk||0)
    : Number(summary.confirmedSalaryCzk||0)+Number(summary.predictedSalaryCzk||0);
  const employeeNet = employeeEarned-advanceTotal;
  const managerPeriodLabel = useMemo(()=>data?.period?.start&&data?.period?.end?formatPeriod(data.period.start,data.period.end,locale):'-',[data?.period?.start,data?.period?.end,locale]);
  const localizedStatus = status => t(`common.${STATUS_KEYS[String(status||'DRAFT').toUpperCase()]||'draft'}`);
  const localizedEmployeeStatus = status => String(status||'').toUpperCase()==='ACTIVE'?t('projects.active'):t('projects.inactive');

  const advanceLabel = language==='cs'?'Zálohy':language==='en'?'Advances':'Залоги';
  const netLabel = language==='cs'?'Čistě k výplatě':language==='en'?'Net payable':'Чиста зарплата';

  return <section className="payrollReportPage pageStack">
    {isManager?<div className="managerPayrollDesktop"><header className="payrollReport-toolbar screenCard noPrint"><div className="compactHeader"><h1>{t('payroll.title')}</h1><p>{t('payroll.printCopy')}</p></div><div className="payrollReport-actions"><Link to="/dashboard">{t('payroll.back')}</Link><button type="button" onClick={()=>window.print()} disabled={isLoading||Boolean(error)}>{t('payroll.print')}</button></div></header><section className="payrollReport-filters screenCard noPrint" aria-label={t('payroll.period')}><div className="payrollPeriodToggle" role="group" aria-label={t('payroll.periodType')}><button className={managerPeriod==='month'?'is-active':''} type="button" disabled={isLoading} onClick={()=>setManagerPeriod('month')}>{t('payroll.month')}</button><button className={managerPeriod==='week'?'is-active':''} type="button" disabled={isLoading} onClick={()=>setManagerPeriod('week')}>{t('payroll.week')}</button></div><div className="payrollPeriodNavigation"><button type="button" disabled={isLoading} onClick={()=>setManagerAnchor(current=>shiftAnchor(current,managerPeriod,-1))}>{t('payroll.previous')}</button><label className="payrollPeriodDate"><span>{t('payroll.periodDate')}</span><input type="date" value={managerAnchor} disabled={isLoading} onChange={event=>setManagerAnchor(event.target.value||getLocalDateKey())}/></label><button type="button" disabled={isLoading} onClick={()=>setManagerAnchor(current=>shiftAnchor(current,managerPeriod,1))}>{t('payroll.next')}</button><button type="button" disabled={isLoading} onClick={()=>setManagerAnchor(getLocalDateKey())}>{t('payroll.today')}</button></div></section></div>:null}
    {isLoading?<RequestLoadingState label={t('payroll.preparing')}/>:null}
    {error?<p className="statusNote is-error noPrint">{getApiErrorMessage(error)}</p>:null}
    {!isLoading&&!error&&isManager?<ManagerPayrollDashboard anchor={managerAnchor} employees={managerEmployees} isLoading={isLoading} locale={locale} onAnchorChange={value=>setManagerAnchor(value||getLocalDateKey())} onPeriodChange={setManagerPeriod} onShift={direction=>setManagerAnchor(current=>shiftAnchor(current,managerPeriod,direction))} onPrint={()=>window.print()} period={managerPeriod} periodLabel={managerPeriodLabel} summary={summary} t={t}/>:null}
    {!isLoading&&!error&&isManager?<div className="noPrint"><ManagerAdvancesPage embedded /></div>:null}
    {!isLoading&&!error&&!isManager?<EmployeeFinanceDashboard advances={employeeAdvances} companyName={companyName} hourlyRate={hourlyRate} language={language} locale={locale} localizedStatus={localizedStatus} monthData={employeePeriod==='month'?data:null} onChangePeriod={direction=>setEmployeeAnchor(current=>shiftAnchor(current,employeePeriod,direction))} onPeriodChange={next=>{setEmployeePeriod(next);setEmployeeAnchor(current=>next==='month'?`${monthKeyFromAnchor(current)}-01`:current)}} period={employeePeriod} submission={submission} summary={summary} user={user} week={week} workRules={data?.workRules}/>:null}
    {!isLoading&&!error?<article className={`payrollReport-sheet${!isManager?' is-employee-print':' is-manager-print'}`}><header className="payrollReport-header"><div><p className="payrollReport-brand">WorkTrack</p><h2>{isManager?t('payroll.companyReport'):t('payroll.employeeStatement')}</h2></div><div className="payrollReport-company"><strong>{companyName}</strong><span>{isManager?t('payroll.managerReport'):getEmployeeName(user)}</span></div></header><section className="payrollReport-meta">{!isManager&&week?<><ReportRow label={t('payroll.weekStart')} value={week.weekStart||'-'}/><ReportRow label={t('payroll.weekEnd')} value={week.weekEnd||'-'}/><ReportRow label={t('payroll.weekStatus')} value={localizedStatus(submission?.status)}/><ReportRow label={t('payroll.hourlyRate')} value={formatCzk(hourlyRate,locale)}/></>:isManager?<><ReportRow label={t('payroll.periodType')} value={data?.period?.type==='month'?t('payroll.month'):t('payroll.week')}/><ReportRow label={t('payroll.period')} value={managerPeriodLabel}/><ReportRow label={t('payroll.employees')} value={String(summary.employeeCount||0)}/><ReportRow label={t('payroll.employeesWithHours')} value={String(summary.employeesWithHours||0)}/></>:<><ReportRow label={t('payroll.periodType')} value={t('payroll.month')}/><ReportRow label={t('payroll.period')} value={formatMonthPeriod(data?.month,locale)}/><ReportRow label={t('payroll.hourlyRate')} value={formatCzk(hourlyRate,locale)}/></>}</section><section className="payrollReport-summary"><h3>{isManager?t('payroll.payrollTotals'):t('payroll.hoursSalary')}</h3>{isManager?<><ReportRow label={t('payroll.approvedHours')} value={formatHours(summary.approvedHours,locale)}/><ReportRow label={t('payroll.pendingHours')} value={formatHours(summary.pendingHours,locale)}/><ReportRow label={t('payroll.confirmedPayroll')} value={formatCzk(summary.confirmedSalaryCzk,locale)} emphasize/><ReportRow label={t('payroll.predictedPayroll')} value={formatCzk(summary.predictedSalaryCzk,locale)}/></>:employeePeriod==='month'?<><ReportRow label={t('payroll.totalSavedHours')} value={formatHours(summary.totalHours,locale)}/><ReportRow label={t('payroll.approvedHours')} value={formatHours(summary.approvedHours,locale)}/><ReportRow label={t('payroll.pendingHours')} value={formatHours(summary.pendingHours,locale)}/><ReportRow label={t('payroll.confirmedSalary')} value={formatCzk(summary.approvedAmountCzk,locale)}/><ReportRow label={t('payroll.predictedSalary')} value={formatCzk(summary.pendingAmountCzk,locale)}/><ReportRow label={advanceLabel} value={`− ${formatCzk(advanceTotal,locale)}`}/><ReportRow label={netLabel} value={formatCzk(employeeNet,locale)} emphasize/></>:<><ReportRow label={t('payroll.totalSavedHours')} value={formatHours(summary.totalHours,locale)}/><ReportRow label={t('payroll.approvedHours')} value={formatHours(summary.approvedHours,locale)}/><ReportRow label={t('payroll.pendingHours')} value={formatHours(summary.pendingHours,locale)}/><ReportRow label={t('payroll.confirmedSalary')} value={formatCzk(summary.confirmedSalaryCzk,locale)}/><ReportRow label={t('payroll.predictedSalary')} value={formatCzk(summary.predictedSalaryCzk,locale)}/><ReportRow label={advanceLabel} value={`− ${formatCzk(advanceTotal,locale)}`}/><ReportRow label={netLabel} value={formatCzk(employeeNet,locale)} emphasize/></>}</section>{isManager?<section className="payrollReport-employeeSection"><div className="payrollReport-sectionHeader"><h3>{t('payroll.breakdown')}</h3><span>{managerEmployees.length} {t('payroll.employees').toLowerCase()}</span></div><div className="payrollReport-tableWrap"><table className="payrollReport-table"><thead><tr><th>{t('payroll.employee')}</th><th>{t('payroll.status')}</th><th>{t('payroll.rate')}</th><th>{t('payroll.approved')}</th><th>{t('payroll.pending')}</th><th>{t('payroll.confirmed')}</th><th>{t('payroll.predicted')}</th></tr></thead><tbody>{managerEmployees.map(employee=><tr key={employee.id}><td><strong>{employee.name}</strong><span>{employee.email}</span></td><td>{localizedEmployeeStatus(employee.status)}</td><td>{employee.mixedRates?(MIXED_RATE_LABELS[language]||MIXED_RATE_LABELS.uk):formatCzk(employee.effectiveRateCzk??employee.hourlyRateCzk,locale)}</td><td>{formatHours(employee.summary?.approvedHours,locale)}</td><td>{formatHours(employee.summary?.pendingHours,locale)}</td><td>{formatCzk(employee.summary?.confirmedSalaryCzk,locale)}</td><td>{formatCzk(employee.summary?.predictedSalaryCzk,locale)}</td></tr>)}</tbody></table></div></section>:null}<footer className="payrollReport-footer"><p>{t('payroll.footer')}</p><span>{t('payroll.generated')}</span></footer></article>:null}
  </section>;
}
