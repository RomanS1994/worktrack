import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import './SectionTabs.css';

const COPY={
 uk:{time:'Час',week:'Тиждень',calendar:'Календар',history:'Історія',team:'Команда',employees:'Працівники',projects:'Об’єкти',timesheet:'Табель',finance:'Зарплата',overview:'Звіт',invoices:'Фактури',details:'Реквізити'},
 cs:{time:'Čas',week:'Týden',calendar:'Kalendář',history:'Historie',team:'Tým',employees:'Zaměstnanci',projects:'Objekty',timesheet:'Výkaz',finance:'Mzda',overview:'Přehled',invoices:'Faktury',details:'Údaje'},
 en:{time:'Time',week:'Week',calendar:'Calendar',history:'History',team:'Team',employees:'Employees',projects:'Projects',timesheet:'Timesheet',finance:'Payroll',overview:'Report',invoices:'Invoices',details:'Billing details'}
};

const CONFIG={
 time:c=>[
  {to:'/hours',label:c.week,end:true},
  {to:'/calendar',label:c.calendar},
  {to:'/hours-table',label:c.history},
 ],
 team:c=>[
  {to:'/employees',label:c.employees},
  {to:'/projects',label:c.projects},
  {to:'/manager/timesheet',label:c.timesheet},
 ],
 employeeFinance:c=>[
  {to:'/payroll-report',label:c.overview,end:true},
  {to:'/invoices',label:c.invoices},
  {to:'/tax-information',label:c.details},
 ],
 managerFinance:c=>[
  {to:'/payroll-report',label:c.overview,end:true},
  {to:'/manager/invoices',label:c.invoices},
 ],
};

export function SectionTabs({section}){
 const {language}=useI18n();
 const user=useSelector(selectUser);
 const c=COPY[language]||COPY.uk;
 const configKey=section==='finance'?(hasManagerAccess(user)?'managerFinance':'employeeFinance'):section;
 const tabs=CONFIG[configKey]?.(c)||[];
 return <nav className="sectionTabs" aria-label={c[section]||section}>
  {tabs.map(tab=><NavLink key={tab.to} to={tab.to} end={tab.end} className={({isActive})=>`sectionTabs-item${isActive?' is-active':''}`}>{tab.label}</NavLink>)}
 </nav>;
}
