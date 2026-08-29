import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import './SectionTabs.css';

const COPY={
 uk:{time:'Години',week:'Тиждень',calendar:'Календар',history:'Історія',team:'Команда',employees:'Працівники',projects:'Об’єкти',timesheet:'Табель',approvals:'Погодження',finance:'Зарплата',overview:'Звіт',payrollReport:'Звіт по зарплаті',invoices:'Фактури',details:'Реквізити'},
 cs:{time:'Hodiny',week:'Týden',calendar:'Kalendář',history:'Historie',team:'Tým',employees:'Zaměstnanci',projects:'Objekty',timesheet:'Výkaz',approvals:'Schválení',finance:'Mzda',overview:'Přehled',payrollReport:'Mzdový report',invoices:'Faktury',details:'Údaje'},
 en:{time:'Hours',week:'Week',calendar:'Calendar',history:'History',team:'Team',employees:'Employees',projects:'Projects',timesheet:'Timesheet',approvals:'Approvals',finance:'Payroll',overview:'Report',payrollReport:'Payroll report',invoices:'Invoices',details:'Billing details'}
};

const CONFIG={
 time:c=>[
  {to:'/hours',label:c.week,end:true},
  {to:'/calendar',label:c.calendar},
  {to:'/hours-table',label:c.history},
 ],
 managerTime:c=>[
  {to:'/manager/timesheet',label:c.timesheet},
  {to:'/approvals',label:c.approvals},
 ],
 team:c=>[
  {to:'/employees',label:c.employees},
  {to:'/projects',label:c.projects},
 ],
 employeeFinance:c=>[
  {to:'/payroll-report',label:c.overview,end:true},
  {to:'/invoices',label:c.invoices},
  {to:'/tax-information',label:c.details},
 ],
 managerFinance:c=>[
  {to:'/payroll-report',label:c.payrollReport,end:true},
  {to:'/manager/invoices',label:c.invoices},
 ],
};

export function SectionTabs({section}){
 const {language}=useI18n();
 const user=useSelector(selectUser);
 const c=COPY[language]||COPY.uk;
 const isManager=hasManagerAccess(user);
 const configKey=section==='finance'?(isManager?'managerFinance':'employeeFinance'):section==='time'&&isManager?'managerTime':section;
 const tabs=CONFIG[configKey]?.(c)||[];
 return <nav className={`sectionTabs sectionTabs-${configKey}`} aria-label={c[section]||section}>
  {tabs.map(tab=><NavLink key={tab.to} to={tab.to} end={tab.end} className={({isActive})=>`sectionTabs-item${isActive?' is-active':''}`}>{tab.label}</NavLink>)}
 </nav>;
}
