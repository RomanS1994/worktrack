import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetInvoicesQuery, useGetManagerInvoicesQuery, useMarkInvoiceViewedMutation } from '../../features/worktrack/billingApi.js';
import './InvoiceDocumentPage.css';

const COPY={
 uk:{back:'Назад до фактур',print:'Друк / Зберегти PDF',invoice:'ФАКТУРА',supplier:'Постачальник',customer:'Замовник',ico:'IČO',dic:'DIČ',account:'Рахунок / IBAN',issue:'Дата виставлення',due:'Термін оплати',period:'Період робіт',date:'Дата',description:'Опис',hours:'Години',rate:'Ставка',amount:'Сума',total:'До сплати',loading:'Завантаження фактури…',missing:'Фактуру не знайдено.'},
 cs:{back:'Zpět na faktury',print:'Tisk / Uložit PDF',invoice:'FAKTURA',supplier:'Dodavatel',customer:'Odběratel',ico:'IČO',dic:'DIČ',account:'Účet / IBAN',issue:'Datum vystavení',due:'Datum splatnosti',period:'Období prací',date:'Datum',description:'Popis',hours:'Hodiny',rate:'Sazba',amount:'Částka',total:'Celkem k úhradě',loading:'Načítání faktury…',missing:'Faktura nebyla nalezena.'},
 en:{back:'Back to invoices',print:'Print / Save PDF',invoice:'INVOICE',supplier:'Supplier',customer:'Customer',ico:'Company ID',dic:'VAT ID',account:'Account / IBAN',issue:'Issue date',due:'Due date',period:'Work period',date:'Date',description:'Description',hours:'Hours',rate:'Rate',amount:'Amount',total:'Total due',loading:'Loading invoice…',missing:'Invoice not found.'}
};
function money(value,currency){return `${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency||''}`}

export function InvoiceDocumentPage({managerMode=false}){
 const {invoiceId}=useParams();
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const viewedRef=useRef('');
 const employeeQuery=useGetInvoicesQuery(undefined,{skip:managerMode});
 const managerQuery=useGetManagerInvoicesQuery(undefined,{skip:!managerMode});
 const [markViewed]=useMarkInvoiceViewedMutation();
 const activeQuery=managerMode?managerQuery:employeeQuery;
 const invoice=(activeQuery.data?.invoices||[]).find(item=>item.id===invoiceId);

 useEffect(()=>{
  if(!managerMode||!invoice||invoice.status!=='SENT'||viewedRef.current===invoice.id)return;
  viewedRef.current=invoice.id;
  markViewed(invoice.id).unwrap().catch(()=>{viewedRef.current=''});
 },[invoice,managerMode,markViewed]);

 if(activeQuery.isLoading)return <section className="invoiceDocState screenCard">{c.loading}</section>;
 if(activeQuery.error)return <section className="invoiceDocState screenCard statusNote is-error">{getApiErrorMessage(activeQuery.error)}</section>;
 if(!invoice)return <section className="invoiceDocState screenCard">{c.missing}</section>;
 const seller=invoice.seller||{};const buyer=invoice.buyer||{};
 return <section className="invoiceDocumentPage">
  <div className="invoiceDocumentActions noPrint"><button type="button" onClick={()=>navigate(managerMode?'/manager/invoices':'/invoices')}>← {c.back}</button><button className="invoiceDocumentPrint" type="button" onClick={()=>window.print()}>{c.print}</button></div>
  <article className="invoicePaper">
   <header className="invoicePaperHeader"><div><p>WorkTrack</p><h1>{c.invoice}</h1></div><div className="invoiceNumber"><span>{invoice.invoiceNumber}</span><strong>{invoice.status}</strong></div></header>
   <section className="invoiceParties"><div><h2>{c.supplier}</h2><strong>{seller.businessName||'—'}</strong><p>{seller.address||'—'}</p><p>{c.ico}: {seller.ico||'—'}{seller.dic?` · ${c.dic}: ${seller.dic}`:''}</p><p>{seller.email||''}</p><p>{c.account}: {seller.iban||'—'}</p></div><div><h2>{c.customer}</h2><strong>{buyer.name||'—'}</strong><p>{buyer.address||'—'}</p><p>{c.ico}: {buyer.ico||'—'}{buyer.dic?` · ${c.dic}: ${buyer.dic}`:''}</p><p>{buyer.email||''}</p></div></section>
   <section className="invoiceDates"><div><span>{c.issue}</span><strong>{invoice.issueDate}</strong></div><div><span>{c.due}</span><strong>{invoice.dueDate}</strong></div><div><span>{c.period}</span><strong>{invoice.periodStart} — {invoice.periodEnd}</strong></div></section>
   <div className="invoiceItemsWrap"><table className="invoiceItems"><thead><tr><th>{c.date}</th><th>{c.description}</th><th>{c.hours}</th><th>{c.rate}</th><th>{c.amount}</th></tr></thead><tbody>{(invoice.items||[]).map(item=><tr key={item.id}><td>{item.workDate}</td><td>{item.description}</td><td>{item.hours}</td><td>{money(item.hourlyRate,invoice.currency)}</td><td>{money(item.amount,invoice.currency)}</td></tr>)}</tbody></table></div>
   <footer className="invoiceTotal"><div><span>{invoice.totalHours} h</span><span>× {money(invoice.hourlyRate,invoice.currency)}</span></div><div><span>{c.total}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div></footer>
  </article>
 </section>;
}
