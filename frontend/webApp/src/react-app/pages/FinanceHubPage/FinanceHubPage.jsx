import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './FinanceHubPage.css';

const COPY={
 uk:{eyebrow:'Фінанси',title:'Фінанси',employeeCopy:'Зарплата, фактури та реквізити в одному місці.',managerCopy:'Зарплати команди та отримані фактури.',approved:'Погоджено',predicted:'Очікується',payroll:'Звіт по зарплаті',payrollCopy:'Перегляд сум і друк звіту',invoices:'Фактури',employeeInvoices:'Створення та статус ваших фактур',managerInvoices:'Отримані фактури працівників',details:'Реквізити',detailsCopy:'IČO, DIČ, IBAN та налаштування фактур'},
 cs:{eyebrow:'Finance',title:'Finance',employeeCopy:'Mzda, faktury a fakturační údaje na jednom místě.',managerCopy:'Mzdy týmu a přijaté faktury.',approved:'Schváleno',predicted:'Očekává se',payroll:'Mzdový přehled',payrollCopy:'Přehled částek a tisk reportu',invoices:'Faktury',employeeInvoices:'Vytváření a stav vašich faktur',managerInvoices:'Přijaté faktury zaměstnanců',details:'Fakturační údaje',detailsCopy:'IČO, DIČ, IBAN a nastavení faktur'},
 en:{eyebrow:'Finance',title:'Finance',employeeCopy:'Salary, invoices and billing details in one place.',managerCopy:'Team payroll and received invoices.',approved:'Approved',predicted:'Expected',payroll:'Payroll report',payrollCopy:'Review amounts and print a report',invoices:'Invoices',employeeInvoices:'Create and track your invoices',managerInvoices:'Invoices received from employees',details:'Billing details',detailsCopy:'Company ID, VAT ID, IBAN and invoice settings'}
};
function money(value){return `${new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:2}).format(Number(value||0))} Kč`}

export function FinanceHubPage(){
 const user=useSelector(selectUser); const isManager=hasManagerAccess(user); const {language}=useI18n(); const c=COPY[language]||COPY.uk;
 const {data,error,isLoading}=useGetWorkSummaryQuery(); const summary=data?.summary||{};
 return <section className="financeHub pageStack">
  <header className="financeHubHeader">
   <div className="financeHubHeroCopy"><p className="sectionEyebrow">{c.eyebrow}</p><h2>{c.title}</h2><p>{isManager?c.managerCopy:c.employeeCopy}</p></div>
   <div className="financeHubHeroIcon" aria-hidden="true"><SvgIcon name="wallet" /></div>
  </header>
  {isLoading?<RequestLoadingState label={c.title}/>:null}{error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
  {!isLoading&&!error?<section className="financeHubTotals">
   <article><span>{c.approved}</span><strong>{money(summary.confirmedSalaryCzk)}</strong><i className="financeHubTotalIcon is-approved"><SvgIcon name="check" /></i></article>
   <article><span>{c.predicted}</span><strong>{money(summary.predictedSalaryCzk)}</strong><i className="financeHubTotalIcon"><SvgIcon name="clock" /></i></article>
  </section>:null}
  <section className="financeHubLinks screenCard">
   <Link to="/payroll-report"><span className="financeHubIcon"><SvgIcon name="wallet" /></span><span><strong>{c.payroll}</strong><small>{c.payrollCopy}</small></span><b>›</b></Link>
   <Link to={isManager?'/manager/invoices':'/invoices'}><span className="financeHubIcon"><SvgIcon name="document" /></span><span><strong>{c.invoices}</strong><small>{isManager?c.managerInvoices:c.employeeInvoices}</small></span><b>›</b></Link>
   {!isManager?<Link to="/tax-information"><span className="financeHubIcon"><SvgIcon name="profile" /></span><span><strong>{c.details}</strong><small>{c.detailsCopy}</small></span><b>›</b></Link>:null}
  </section>
 </section>;
}
