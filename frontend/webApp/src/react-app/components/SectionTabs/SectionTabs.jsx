import { NavLink } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './SectionTabs.css';

const COPY={
 uk:{time:'Час',week:'Тиждень',calendar:'Календар',history:'Історія',team:'Команда',employees:'Працівники',projects:'Об’єкти',finance:'Фінанси',overview:'Огляд',payroll:'Зарплата',invoices:'Фактури',details:'Реквізити'},
 cs:{time:'Čas',week:'Týden',calendar:'Kalendář',history:'Historie',team:'Tým',employees:'Zaměstnanci',projects:'Objekty',finance:'Finance',overview:'Přehled',payroll:'Mzdy',invoices:'Faktury',details:'Údaje'},
 en:{time:'Time',week:'Week',calendar:'Calendar',history:'History',team:'Team',employees:'Employees',projects:'Projects',finance:'Finance',overview:'Overview',payroll:'Payroll',invoices:'Invoices',details:'Billing details'}
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
 ],
 employeeFinance:c=>[
  {to:'/finance',label:c.overview,end:true},
  {to:'/payroll-report',label:c.payroll},
  {to:'/invoices',label:c.invoices},
  {to:'/tax-information',label:c.details},
 ],
 managerFinance:c=>[
  {to:'/finance',label:c.overview,end:true},
  {to:'/payroll-report',label:c.payroll},
  {to:'/manager/invoices',label:c.invoices},
 ],
};

export function SectionTabs({section}){
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const tabs=CONFIG[section]?.(c)||[];
 return <nav className="sectionTabs" aria-label={c[section]||section}>
  {tabs.map(tab=><NavLink key={tab.to} to={tab.to} end={tab.end} className={({isActive})=>`sectionTabs-item${isActive?' is-active':''}`}>{tab.label}</NavLink>)}
 </nav>;
}
