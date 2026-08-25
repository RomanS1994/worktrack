import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetInvoiceHistoryQuery,
  useGetInvoicesQuery,
  useGetManagerInvoiceHistoryQuery,
  useGetManagerInvoicesQuery,
  useMarkInvoiceViewedMutation,
} from '../../features/worktrack/billingApi.js';
import './InvoiceDocumentPage.css';

const COPY={
 uk:{back:'Назад до фактур',print:'Друк / Зберегти PDF',invoice:'ФАКТУРА',supplier:'Постачальник',customer:'Замовник',ico:'IČO',dic:'DIČ',account:'Рахунок / IBAN',issue:'Дата виставлення',due:'Термін оплати',period:'Період робіт',date:'Дата',description:'Опис',hours:'Години',rate:'Ставка',amount:'Сума',total:'До сплати',loading:'Завантаження фактури…',missing:'Фактуру не знайдено.',payment:'Платіжні дані',variableSymbol:'Варіабельний символ',spayd:'QR Platba / SPAYD',copy:'Копіювати платіжні дані',copied:'Скопійовано',scan:'Скануйте для оплати',history:'Історія фактури',created:'Створено чернетку',sent:'Відправлено роботодавцю',viewed:'Переглянуто роботодавцем',paid:'Позначено оплачено',cancelled:'Скасовано',draftStatus:'Чернетка',sentStatus:'Відправлено',viewedStatus:'Переглянуто',paidStatus:'Оплачено',cancelledStatus:'Скасовано',overdueStatus:'Прострочено'},
 cs:{back:'Zpět na faktury',print:'Tisk / Uložit PDF',invoice:'FAKTURA',supplier:'Dodavatel',customer:'Odběratel',ico:'IČO',dic:'DIČ',account:'Účet / IBAN',issue:'Datum vystavení',due:'Datum splatnosti',period:'Období prací',date:'Datum',description:'Popis',hours:'Hodiny',rate:'Sazba',amount:'Částka',total:'Celkem k úhradě',loading:'Načítání faktury…',missing:'Faktura nebyla nalezena.',payment:'Platební údaje',variableSymbol:'Variabilní symbol',spayd:'QR Platba / SPAYD',copy:'Kopírovat platební údaje',copied:'Zkopírováno',scan:'Naskenujte pro platbu',history:'Historie faktury',created:'Vytvořen koncept',sent:'Odesláno zaměstnavateli',viewed:'Zobrazeno zaměstnavatelem',paid:'Označeno jako zaplacené',cancelled:'Zrušeno',draftStatus:'Koncept',sentStatus:'Odesláno',viewedStatus:'Zobrazeno',paidStatus:'Zaplaceno',cancelledStatus:'Zrušeno',overdueStatus:'Po splatnosti'},
 en:{back:'Back to invoices',print:'Print / Save PDF',invoice:'INVOICE',supplier:'Supplier',customer:'Customer',ico:'Company ID',dic:'VAT ID',account:'Account / IBAN',issue:'Issue date',due:'Due date',period:'Work period',date:'Date',description:'Description',hours:'Hours',rate:'Rate',amount:'Amount',total:'Total due',loading:'Loading invoice…',missing:'Invoice not found.',payment:'Payment details',variableSymbol:'Variable symbol',spayd:'QR payment / SPAYD',copy:'Copy payment details',copied:'Copied',scan:'Scan to pay',history:'Invoice history',created:'Draft created',sent:'Sent to employer',viewed:'Viewed by employer',paid:'Marked as paid',cancelled:'Cancelled',draftStatus:'Draft',sentStatus:'Sent',viewedStatus:'Viewed',paidStatus:'Paid',cancelledStatus:'Cancelled',overdueStatus:'Overdue'}
};
function money(value,currency){return `${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency||''}`}
function qrUrl(descriptor){return descriptor?`https://quickchart.io/qr?text=${encodeURIComponent(descriptor)}&size=220&margin=2&ecLevel=M&format=svg`:''}
function historyLabel(c,action){const key=String(action||'').split('.').pop();return c[key]||action}
function historyDate(value,language){try{return new Intl.DateTimeFormat(language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return value}}
function statusLabel(c,invoice){if(invoice?.isOverdue)return c.overdueStatus;const map={DRAFT:c.draftStatus,SENT:c.sentStatus,VIEWED:c.viewedStatus,PAID:c.paidStatus,CANCELLED:c.cancelledStatus};return map[invoice?.status]||invoice?.status||''}

export function InvoiceDocumentPage({managerMode=false}){
 const {invoiceId}=useParams();
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const viewedRef=useRef('');
 const [copied,setCopied]=useState(false);
 const employeeQuery=useGetInvoicesQuery(undefined,{skip:managerMode});
 const managerQuery=useGetManagerInvoicesQuery(undefined,{skip:!managerMode});
 const employeeHistory=useGetInvoiceHistoryQuery(invoiceId,{skip:managerMode||!invoiceId});
 const managerHistory=useGetManagerInvoiceHistoryQuery(invoiceId,{skip:!managerMode||!invoiceId});
 const [markViewed]=useMarkInvoiceViewedMutation();
 const activeQuery=managerMode?managerQuery:employeeQuery;
 const historyQuery=managerMode?managerHistory:employeeHistory;
 const invoice=(activeQuery.data?.invoices||[]).find(item=>item.id===invoiceId);

 useEffect(()=>{
  if(!managerMode||!invoice||invoice.status!=='SENT'||viewedRef.current===invoice.id)return;
  viewedRef.current=invoice.id;
  markViewed(invoice.id).unwrap().then(()=>historyQuery.refetch()).catch(()=>{viewedRef.current=''});
 },[invoice,managerMode,markViewed,historyQuery]);

 useEffect(()=>{
  if(!invoice?.invoiceNumber)return undefined;
  const previousTitle=document.title;
  document.title=`${invoice.invoiceNumber} · WorkTrack`;
  return()=>{document.title=previousTitle};
 },[invoice?.invoiceNumber]);

 async function copyPayment(){if(!invoice?.paymentDescriptor)return;try{await navigator.clipboard.writeText(invoice.paymentDescriptor);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{/* Clipboard may be unavailable on some embedded browsers. */}}
 function printInvoice(){if(!invoice?.invoiceNumber)return;const previousTitle=document.title;document.title=`${invoice.invoiceNumber} · WorkTrack`;window.print();window.setTimeout(()=>{document.title=previousTitle},0)}

 if(activeQuery.isLoading)return <section className="invoiceDocState screenCard">{c.loading}</section>;
 if(activeQuery.error)return <section className="invoiceDocState screenCard statusNote is-error">{getApiErrorMessage(activeQuery.error)}</section>;
 if(!invoice)return <section className="invoiceDocState screenCard">{c.missing}</section>;
 const seller=invoice.seller||{};const buyer=invoice.buyer||{};const paymentQr=qrUrl(invoice.paymentDescriptor);const history=historyQuery.data?.history||[];const currentStatus=statusLabel(c,invoice);
 return <section className="invoiceDocumentPage">
  <div className="invoiceDocumentActions noPrint"><button type="button" onClick={()=>navigate(managerMode?'/manager/invoices':'/invoices')}>← {c.back}</button><button className="invoiceDocumentPrint" type="button" onClick={printInvoice}>{c.print}</button></div>
  <article className={`invoicePaper${invoice.isOverdue?' is-overdue':''}`} data-invoice-number={invoice.invoiceNumber}>
   <header className="invoicePaperHeader"><div><p>WorkTrack</p><h1>{c.invoice}</h1></div><div className="invoiceNumber"><span>{invoice.invoiceNumber}</span><strong className={`invoiceDocStatus is-${invoice.isOverdue?'overdue':String(invoice.status).toLowerCase()}`}>{currentStatus}</strong></div></header>
   <section className="invoiceParties"><div><h2>{c.supplier}</h2><strong>{seller.businessName||'—'}</strong><p>{seller.address||'—'}</p><p>{c.ico}: {seller.ico||'—'}{seller.dic?` · ${c.dic}: ${seller.dic}`:''}</p><p>{seller.email||''}</p><p>{c.account}: {seller.iban||'—'}</p></div><div><h2>{c.customer}</h2><strong>{buyer.name||'—'}</strong><p>{buyer.address||'—'}</p><p>{c.ico}: {buyer.ico||'—'}{buyer.dic?` · ${c.dic}: ${buyer.dic}`:''}</p><p>{buyer.email||''}</p></div></section>
   <section className="invoiceDates"><div><span>{c.issue}</span><strong>{invoice.issueDate}</strong></div><div className={invoice.isOverdue?'is-overdue':''}><span>{c.due}</span><strong>{invoice.dueDate}</strong></div><div><span>{c.period}</span><strong>{invoice.periodStart} — {invoice.periodEnd}</strong></div></section>
   <section className="invoicePayment"><div className="invoicePaymentHeading"><h2>{c.payment}</h2><button className="noPrint" type="button" onClick={copyPayment} disabled={!invoice.paymentDescriptor}>{copied?c.copied:c.copy}</button></div><div className="invoicePaymentBody"><div className="invoicePaymentDetails"><div className="invoicePaymentGrid"><div><span>{c.account}</span><strong>{seller.iban||'—'}</strong></div><div><span>{c.variableSymbol}</span><strong>{invoice.variableSymbol||'—'}</strong></div><div><span>{c.amount}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div></div>{invoice.paymentDescriptor?<div className="invoiceSpayd"><span>{c.spayd}</span><code>{invoice.paymentDescriptor}</code></div>:null}</div>{paymentQr?<figure className="invoicePaymentQr"><img src={paymentQr} alt={c.scan} referrerPolicy="no-referrer"/><figcaption>{c.scan}</figcaption></figure>:null}</div></section>
   <div className="invoiceItemsWrap"><table className="invoiceItems"><thead><tr><th>{c.date}</th><th>{c.description}</th><th>{c.hours}</th><th>{c.rate}</th><th>{c.amount}</th></tr></thead><tbody>{(invoice.items||[]).map(item=><tr key={item.id}><td>{item.workDate}</td><td>{item.description}</td><td>{item.hours}</td><td>{money(item.hourlyRate,invoice.currency)}</td><td>{money(item.amount,invoice.currency)}</td></tr>)}</tbody></table></div>
   <footer className="invoiceTotal"><div><span>{invoice.totalHours} h</span><span>× {money(invoice.hourlyRate,invoice.currency)}</span></div><div><span>{c.total}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div></footer>
  </article>
  <section className="invoiceHistory screenCard noPrint"><h2>{c.history}</h2>{historyQuery.isLoading?<p>…</p>:history.length?<ol>{history.map(item=><li key={item.id}><span className="invoiceHistoryDot"/><div><strong>{historyLabel(c,item.action)}</strong><time>{historyDate(item.createdAt,language)}</time></div></li>)}</ol>:<p>—</p>}</section>
 </section>;
}
