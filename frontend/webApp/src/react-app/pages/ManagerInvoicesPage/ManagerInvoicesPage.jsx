import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetManagerInvoicesQuery, useMarkInvoicePaidMutation } from '../../features/worktrack/billingApi.js';
import './ManagerInvoicesPage.css';

const COPY={
 uk:{eyebrow:'Фактури',title:'Фактури працівників',subtitle:'Отримані фактури та статус оплати.',empty:'Фактур за цим фільтром немає.',document:'Документ / PDF',paid:'Позначити оплачено',paying:'Збереження…',hours:'год',due:'Оплатити до',draft:'Чернетка',sent:'Відправлено',viewed:'Переглянуто',paidStatus:'Оплачено',cancelled:'Скасовано',overdue:'Прострочено',all:'Усі',open:'До оплати',overdueFilter:'Прострочені',paidFilter:'Оплачені',cancelledFilter:'Скасовані',markPaidConfirm:'Підтвердити, що цю фактуру оплачено?',openAmount:'До оплати',overdueAmount:'Прострочено',paidAmount:'Оплачено'},
 cs:{eyebrow:'Faktury',title:'Faktury pracovníků',subtitle:'Přijaté faktury a stav plateb.',empty:'Pro tento filtr nejsou žádné faktury.',document:'Doklad / PDF',paid:'Označit jako zaplacené',paying:'Ukládání…',hours:'h',due:'Splatnost',draft:'Koncept',sent:'Odesláno',viewed:'Zobrazeno',paidStatus:'Zaplaceno',cancelled:'Zrušeno',overdue:'Po splatnosti',all:'Vše',open:'K úhradě',overdueFilter:'Po splatnosti',paidFilter:'Zaplacené',cancelledFilter:'Zrušené',markPaidConfirm:'Potvrdit, že tato faktura byla zaplacena?',openAmount:'K úhradě',overdueAmount:'Po splatnosti',paidAmount:'Zaplaceno'},
 en:{eyebrow:'Invoices',title:'Employee invoices',subtitle:'Received invoices and payment status.',empty:'No invoices match this filter.',document:'Document / PDF',paid:'Mark as paid',paying:'Saving…',hours:'h',due:'Due',draft:'Draft',sent:'Sent',viewed:'Viewed',paidStatus:'Paid',cancelled:'Cancelled',overdue:'Overdue',all:'All',open:'Open',overdueFilter:'Overdue',paidFilter:'Paid',cancelledFilter:'Cancelled',markPaidConfirm:'Confirm that this invoice has been paid?',openAmount:'Open amount',overdueAmount:'Overdue',paidAmount:'Paid'}
};
function statusLabel(c,status){if(status==='PAID')return c.paidStatus;return c[String(status||'').toLowerCase()]||status}
function money(value){return `${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})} CZK`}

export function ManagerInvoicesPage(){
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const [error,setError]=useState('');
 const [filter,setFilter]=useState('OPEN');
 const {data,isLoading,refetch}=useGetManagerInvoicesQuery();
 const [markPaid,state]=useMarkInvoicePaidMutation();
 const invoices=data?.invoices||[];
 const summary=data?.summary||{};
 const filtered=useMemo(()=>invoices.filter(invoice=>{
  if(filter==='ALL')return true;
  if(filter==='OPEN')return ['SENT','VIEWED'].includes(invoice.status);
  if(filter==='OVERDUE')return Boolean(invoice.isOverdue);
  if(filter==='PAID')return invoice.status==='PAID';
  if(filter==='CANCELLED')return invoice.status==='CANCELLED';
  return true;
 }),[filter,invoices]);
 const counts={ALL:summary.totalCount??invoices.length,OPEN:summary.openCount??0,OVERDUE:summary.overdueCount??0,PAID:summary.paidCount??0,CANCELLED:summary.cancelledCount??0};
 async function paid(id){if(!window.confirm(c.markPaidConfirm))return;setError('');try{await markPaid(id).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}}
 const filters=[['OPEN',c.open],['OVERDUE',c.overdueFilter],['PAID',c.paidFilter],['CANCELLED',c.cancelledFilter],['ALL',c.all]];
 return <section className="managerInvoicePage pageStack">
  <header className="managerInvoiceHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <section className="managerInvoiceSummary" aria-label={c.title}>
   <article className="screenCard"><span>{c.openAmount}</span><strong>{money(summary.openAmount)}</strong><small>{counts.OPEN}</small></article>
   <article className={`screenCard${Number(summary.overdueAmount||0)>0?' is-overdue':''}`}><span>{c.overdueAmount}</span><strong>{money(summary.overdueAmount)}</strong><small>{counts.OVERDUE}</small></article>
   <article className="screenCard is-paid"><span>{c.paidAmount}</span><strong>{money(summary.paidAmount)}</strong><small>{counts.PAID}</small></article>
  </section>
  <div className="managerInvoiceFilters" role="tablist" aria-label={c.title}>{filters.map(([key,label])=><button type="button" role="tab" aria-selected={filter===key} className={filter===key?'is-active':''} onClick={()=>setFilter(key)} key={key}><span>{label}</span><strong>{counts[key]}</strong></button>)}</div>
  {error?<p className="statusNote is-error">{error}</p>:null}
  <section className="managerInvoiceList">{isLoading?<div className="screenCard">…</div>:filtered.length?filtered.map(invoice=>{
   const overdue=Boolean(invoice.isOverdue);
   return <article className={`managerInvoiceCard screenCard${overdue?' is-overdue':''}`} key={invoice.id}>
    <div className="managerInvoiceTop"><div><span>{invoice.employee?.name||invoice.employee?.email}</span><strong>{invoice.invoiceNumber}</strong></div><div className="managerInvoiceAmount"><strong>{Number(invoice.subtotal).toLocaleString()} {invoice.currency}</strong><div className="managerInvoiceStatusRow"><span className={`invoiceStatus is-${String(invoice.status).toLowerCase()}`}>{statusLabel(c,invoice.status)}</span>{overdue?<span className="invoiceOverdueBadge">{c.overdue}</span>:null}</div></div></div>
    <div className="managerInvoiceMeta"><span>{invoice.periodStart} — {invoice.periodEnd}</span><span>{invoice.totalHours} {c.hours}</span><span className={overdue?'is-overdue-text':''}>{c.due}: {invoice.dueDate}</span></div>
    <div className="managerInvoiceActions"><button className="managerInvoiceDocument" type="button" onClick={()=>navigate(`/manager/invoices/${invoice.id}`)}>{c.document}</button>{['SENT','VIEWED'].includes(invoice.status)?<button type="button" onClick={()=>paid(invoice.id)} disabled={state.isLoading}>{state.isLoading?c.paying:c.paid}</button>:null}</div>
   </article>
  }):<div className="screenCard managerInvoiceEmpty">{c.empty}</div>}</section>
 </section>;
}
