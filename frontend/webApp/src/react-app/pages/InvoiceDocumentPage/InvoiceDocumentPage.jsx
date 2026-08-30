import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetInvoiceHistoryQuery,
  useGetInvoiceQuery,
  useGetManagerInvoiceHistoryQuery,
  useGetManagerInvoiceQuery,
  useMarkInvoiceViewedMutation,
  useSendInvoiceMutation,
} from '../../features/worktrack/billingApi.js';
import { downloadInvoicePdf, shareInvoicePdf } from '../../features/worktrack/invoicePdf.js';
import './InvoiceDocumentPage.css';

const UI_COPY={
 uk:{back:'Назад до фактур',download:'Завантажити PDF',share:'Поділитися PDF',preparing:'Формування PDF…',send:'Відправити роботодавцю',sending:'Відправлення…',sendConfirm:'Відправити цю фактуру роботодавцю? Після відправлення вона стане доступною менеджеру.',loading:'Завантаження фактури…',missing:'Фактуру не знайдено.',copy:'Копіювати платіжні дані',copied:'Скопійовано',history:'Історія фактури',pdfError:'Не вдалося сформувати PDF. Спробуйте ще раз.',created:'Створено чернетку',sent:'Відправлено роботодавцю',viewed:'Переглянуто роботодавцем',paid:'Позначено оплачено',cancelled:'Скасовано'},
 cs:{back:'Zpět na faktury',download:'Stáhnout PDF',share:'Sdílet PDF',preparing:'Vytváření PDF…',send:'Odeslat zaměstnavateli',sending:'Odesílání…',sendConfirm:'Odeslat tuto fakturu zaměstnavateli? Po odeslání bude dostupná manažerovi.',loading:'Načítání faktury…',missing:'Faktura nebyla nalezena.',copy:'Kopírovat platební údaje',copied:'Zkopírováno',history:'Historie faktury',pdfError:'PDF se nepodařilo vytvořit. Zkuste to znovu.',created:'Vytvořen koncept',sent:'Odesláno zaměstnavateli',viewed:'Zobrazeno zaměstnavatelem',paid:'Označeno jako zaplacené',cancelled:'Zrušeno'},
 en:{back:'Back to invoices',download:'Download PDF',share:'Share PDF',preparing:'Creating PDF…',send:'Send to employer',sending:'Sending…',sendConfirm:'Send this invoice to your employer? It will become visible to the manager.',loading:'Loading invoice…',missing:'Invoice not found.',copy:'Copy payment details',copied:'Copied',history:'Invoice history',pdfError:'Could not create the PDF. Please try again.',created:'Draft created',sent:'Sent to employer',viewed:'Viewed by employer',paid:'Marked as paid',cancelled:'Cancelled'}
};

// The invoice/PDF preview itself is intentionally always Czech. UI controls may follow the app language.
const PDF_COPY={
 invoice:'FAKTURA',supplier:'Dodavatel',customer:'Odběratel',ico:'IČO',dic:'DIČ',account:'Účet / IBAN',issue:'Datum vystavení',due:'Datum splatnosti',paidDate:'Datum úhrady',period:'Období prací',payment:'Platební údaje',variableSymbol:'Variabilní symbol',amount:'Částka',total:'Celkem k úhradě',spayd:'QR Platba / SPAYD',scan:'Naskenujte pro platbu',service:'Poskytnuté práce dle přiloženého výkazu hodin',hours:'Hodiny',rate:'Sazba',appendix:'PŘÍLOHA K FAKTUŘE',timesheet:'Výkaz odpracovaných hodin',date:'Datum',description:'Popis práce',itemAmount:'Částka',mixedRates:'Více sazeb',draftStatus:'Koncept',sentStatus:'Odesláno',viewedStatus:'Zobrazeno',paidStatus:'Zaplaceno',cancelledStatus:'Zrušeno',overdueStatus:'Po splatnosti'
};

function money(value,currency){return `${Number(value||0).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency||''}`}
function qrUrl(descriptor){return descriptor?`https://quickchart.io/qr?text=${encodeURIComponent(descriptor)}&size=220&margin=2&ecLevel=M&format=svg`:''}
function historyLabel(c,action){const key=String(action||'').split('.').pop();return c[key]||action}
function historyDate(value,language){try{return new Intl.DateTimeFormat(language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return value}}
function statusLabel(invoice){if(invoice?.isOverdue)return PDF_COPY.overdueStatus;const map={DRAFT:PDF_COPY.draftStatus,SENT:PDF_COPY.sentStatus,VIEWED:PDF_COPY.viewedStatus,PAID:PDF_COPY.paidStatus,CANCELLED:PDF_COPY.cancelledStatus};return map[invoice?.status]||invoice?.status||''}
function dateValue(value){return value?String(value).slice(0,10):''}
function hasMixedRates(items=[]){const rates=new Set(items.map(item=>Number(item.hourlyRate||0).toFixed(2)));return rates.size>1}

export function InvoiceDocumentPage({managerMode=false}){
 const {invoiceId}=useParams();
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=UI_COPY[language]||UI_COPY.uk;
 const viewedRef=useRef('');
 const [copied,setCopied]=useState(false);
 const [actionError,setActionError]=useState('');
 const [pdfAction,setPdfAction]=useState('');
 const employeeQuery=useGetInvoiceQuery(invoiceId,{skip:managerMode||!invoiceId});
 const managerQuery=useGetManagerInvoiceQuery(invoiceId,{skip:!managerMode||!invoiceId});
 const employeeHistory=useGetInvoiceHistoryQuery(invoiceId,{skip:managerMode||!invoiceId});
 const managerHistory=useGetManagerInvoiceHistoryQuery(invoiceId,{skip:!managerMode||!invoiceId});
 const [markViewed]=useMarkInvoiceViewedMutation();
 const [sendInvoice,sendState]=useSendInvoiceMutation();
 const activeQuery=managerMode?managerQuery:employeeQuery;
 const historyQuery=managerMode?managerHistory:employeeHistory;
 const invoice=activeQuery.data?.invoice;

 useEffect(()=>{
  if(!managerMode||!invoice||invoice.status!=='SENT'||viewedRef.current===invoice.id)return;
  viewedRef.current=invoice.id;
  markViewed(invoice.id).unwrap().then(()=>Promise.all([activeQuery.refetch(),historyQuery.refetch()])).catch(()=>{viewedRef.current=''});
 },[invoice,managerMode,markViewed,activeQuery,historyQuery]);

 useEffect(()=>{
  if(!invoice?.invoiceNumber)return undefined;
  const previousTitle=document.title;
  document.title=`${invoice.invoiceNumber} · WorkTrack`;
  return()=>{document.title=previousTitle};
 },[invoice?.invoiceNumber]);

 async function copyPayment(){if(!invoice?.paymentDescriptor)return;try{await navigator.clipboard.writeText(invoice.paymentDescriptor);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{/* Clipboard may be unavailable on some embedded browsers. */}}
 async function downloadPdf(){if(!invoice||pdfAction)return;setActionError('');setPdfAction('download');try{await downloadInvoicePdf(invoice)}catch{setActionError(c.pdfError)}finally{setPdfAction('')}}
 async function sharePdf(){if(!invoice||pdfAction)return;setActionError('');setPdfAction('share');try{await shareInvoicePdf(invoice)}catch(error){if(error?.name!=='AbortError')setActionError(c.pdfError)}finally{setPdfAction('')}}
 async function send(){if(!invoice?.id||managerMode||invoice.status!=='DRAFT'||!window.confirm(c.sendConfirm))return;setActionError('');try{await sendInvoice(invoice.id).unwrap();await Promise.all([activeQuery.refetch(),historyQuery.refetch()])}catch(error){setActionError(getApiErrorMessage(error))}}

 if(activeQuery.isLoading)return <section className="invoiceDocState screenCard">{c.loading}</section>;
 if(activeQuery.error)return <section className="invoiceDocState screenCard statusNote is-error">{getApiErrorMessage(activeQuery.error)}</section>;
 if(!invoice)return <section className="invoiceDocState screenCard">{c.missing}</section>;
 const seller=invoice.seller||{};const buyer=invoice.buyer||{};const paymentQr=qrUrl(invoice.paymentDescriptor);const history=historyQuery.data?.history||[];const currentStatus=statusLabel(invoice);const mixedRates=hasMixedRates(invoice.items||[]);const pdfBusy=Boolean(pdfAction);
 return <section className="invoiceDocumentPage">
  <div className="invoiceDocumentActions noPrint"><button type="button" onClick={()=>navigate(managerMode?'/manager/invoices':'/invoices')}>← {c.back}</button><div className="invoiceDocumentPrimaryActions"><button className="invoiceDocumentPrint" type="button" onClick={downloadPdf} disabled={pdfBusy}>{pdfAction==='download'?c.preparing:c.download}</button><button className="invoiceDocumentShare" type="button" onClick={sharePdf} disabled={pdfBusy}>{pdfAction==='share'?c.preparing:c.share}</button>{!managerMode&&invoice.status==='DRAFT'?<button className="invoiceDocumentSend" type="button" onClick={send} disabled={sendState.isLoading||pdfBusy}>{sendState.isLoading?c.sending:c.send}</button>:null}</div></div>
  {actionError?<div className="invoiceDocumentActionError statusNote is-error noPrint" role="alert">{actionError}</div>:null}

  <article className={`invoicePaper invoiceMainPage${invoice.isOverdue?' is-overdue':''}`} data-invoice-number={invoice.invoiceNumber} lang="cs">
   <header className="invoicePaperHeader"><div><p>WorkTrack</p><h1>{PDF_COPY.invoice}</h1></div><div className="invoiceNumber"><span>{invoice.invoiceNumber}</span><strong className={`invoiceDocStatus is-${invoice.isOverdue?'overdue':String(invoice.status).toLowerCase()}`}>{currentStatus}</strong></div></header>
   <section className="invoiceParties"><div><h2>{PDF_COPY.supplier}</h2><strong>{seller.businessName||'—'}</strong><p>{seller.address||'—'}</p><p>{PDF_COPY.ico}: {seller.ico||'—'}{seller.dic?` · ${PDF_COPY.dic}: ${seller.dic}`:''}</p><p>{seller.email||''}</p><p>{PDF_COPY.account}: {seller.iban||'—'}</p></div><div><h2>{PDF_COPY.customer}</h2><strong>{buyer.name||'—'}</strong><p>{buyer.address||'—'}</p><p>{PDF_COPY.ico}: {buyer.ico||'—'}{buyer.dic?` · ${PDF_COPY.dic}: ${buyer.dic}`:''}</p><p>{buyer.email||''}</p></div></section>
   <section className="invoiceDates"><div><span>{PDF_COPY.issue}</span><strong>{invoice.issueDate}</strong></div><div className={invoice.isOverdue?'is-overdue':''}><span>{PDF_COPY.due}</span><strong>{invoice.dueDate}</strong></div>{invoice.status==='PAID'&&invoice.paidAt?<div className="is-paid"><span>{PDF_COPY.paidDate}</span><strong>{dateValue(invoice.paidAt)}</strong></div>:null}<div><span>{PDF_COPY.period}</span><strong>{invoice.periodStart} — {invoice.periodEnd}</strong></div></section>
   <section className="invoicePayment"><div className="invoicePaymentHeading"><h2>{PDF_COPY.payment}</h2><button className="noPrint" type="button" onClick={copyPayment} disabled={!invoice.paymentDescriptor}>{copied?c.copied:c.copy}</button></div><div className="invoicePaymentBody"><div className="invoicePaymentDetails"><div className="invoicePaymentGrid"><div><span>{PDF_COPY.account}</span><strong>{seller.iban||'—'}</strong></div><div><span>{PDF_COPY.variableSymbol}</span><strong>{invoice.variableSymbol||'—'}</strong></div><div><span>{PDF_COPY.amount}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div></div>{invoice.paymentDescriptor?<div className="invoiceSpayd"><span>{PDF_COPY.spayd}</span><code>{invoice.paymentDescriptor}</code></div>:null}</div>{paymentQr?<figure className="invoicePaymentQr"><img src={paymentQr} alt={PDF_COPY.scan} referrerPolicy="no-referrer"/><figcaption>{PDF_COPY.scan}</figcaption></figure>:null}</div></section>
   <section className="invoiceServiceSummary"><div><span>{PDF_COPY.service}</span><strong>{invoice.totalHours} h</strong></div><div><span>{PDF_COPY.rate}</span><strong>{mixedRates?PDF_COPY.mixedRates:`${money(invoice.hourlyRate,invoice.currency)} / h`}</strong></div></section>
   <footer className="invoiceTotal"><div><span>{invoice.totalHours} h</span><span>{mixedRates?PDF_COPY.mixedRates:`× ${money(invoice.hourlyRate,invoice.currency)}`}</span></div><div><span>{PDF_COPY.total}</span><strong>{money(invoice.subtotal,invoice.currency)}</strong></div></footer>
  </article>

  <article className="invoicePaper invoiceHoursAppendix" lang="cs">
   <header className="invoiceAppendixHeader"><div><p>{PDF_COPY.appendix}</p><h2>{PDF_COPY.timesheet}</h2></div><div><strong>{invoice.invoiceNumber}</strong><span>{invoice.periodStart} — {invoice.periodEnd}</span></div></header>
   <div className="invoiceItemsWrap"><table className="invoiceItems"><thead><tr><th>{PDF_COPY.date}</th><th>{PDF_COPY.description}</th><th>{PDF_COPY.hours}</th><th>{PDF_COPY.rate}</th><th>{PDF_COPY.itemAmount}</th></tr></thead><tbody>{(invoice.items||[]).map(item=><tr key={item.id}><td>{item.workDate}</td><td>{item.description}</td><td>{item.hours}</td><td>{money(item.hourlyRate,invoice.currency)}</td><td>{money(item.amount,invoice.currency)}</td></tr>)}</tbody></table></div>
   <footer className="invoiceAppendixTotal"><span>{PDF_COPY.total}</span><strong>{invoice.totalHours} h · {money(invoice.subtotal,invoice.currency)}</strong></footer>
  </article>

  <section className="invoiceHistory screenCard noPrint"><h2>{c.history}</h2>{historyQuery.isLoading?<p>…</p>:history.length?<ol>{history.map(item=><li key={item.id}><span className="invoiceHistoryDot"/><div><strong>{historyLabel(c,item.action)}</strong><time>{historyDate(item.createdAt,language)}</time></div></li>)}</ol>:<p>—</p>}</section>
 </section>;
}
