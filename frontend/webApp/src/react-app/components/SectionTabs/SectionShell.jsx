import { Outlet } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SectionTabs } from './SectionTabs.jsx';

const FINANCE_COPY={
 uk:{title:'Фінанси',subtitle:'Зарплата, фактури та реквізити'},
 cs:{title:'Finance',subtitle:'Mzda, faktury a fakturační údaje'},
 en:{title:'Finance',subtitle:'Salary, invoices and billing details'},
};

export function SectionShell({section}){
 const {language}=useI18n();
 const financeCopy=FINANCE_COPY[language]||FINANCE_COPY.uk;
 return <div className={`sectionShell sectionShell--${section}`}>
  {section==='finance'?<header className="sectionShellFinanceHeader">
   <h1>{financeCopy.title}</h1>
   <p>{financeCopy.subtitle}</p>
  </header>:null}
  <SectionTabs section={section}/>
  <Outlet/>
 </div>;
}
