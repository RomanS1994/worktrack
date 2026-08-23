import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCancelInvoiceMutation,
  useCreateInvoiceMutation,
  useGetInvoicesQuery,
  useLazyGetInvoicePreviewQuery,
  useSendInvoiceMutation,
} from '../../features/worktrack/billingApi.js';
import './InvoicesPage.css';

const COPY={
 uk:{eyebrow:'Фактури',title:'Мої фактури',subtitle:'Створюйте фактури лише з погоджених годин.',month:'Місяць',preview:'Перевірити фактуру',checking:'Перевірка…',create:'Створити чернетку',creating:'Створення…',empty:'Фактур ще немає.',send:'Відправити роботодавцю',sending:'Відправлення…',cancel:'Скасувати фактуру',cancelling:'Скасування…',document:'Документ / PDF',hours:'год',due:'Оплатити до',draft:'Чернетка',sent:'Відправлено',viewed:'Переглянуто',paid:'Оплачено',cancelled:'Скасовано',previewTitle:'Перевірте фактуру',invoiceNumber:'Номер',period:'Період',rate:'Ставка',total:'До сплати',seller:'Постачальник',buyer:'Замовник',close:'Назад',sendConfirm:'Відправити цю фактуру роботодавцю? Після відправлення вона стане доступною менеджеру.',cancelConfirm:'Скасувати цю фактуру? Години з неї знову можна буде використати для нової фактури.'},
 cs:{eyebrow:'Faktury',title:'Moje faktury',subtitle:'Vytvářejte faktury pouze ze schválených hodin.',month:'Měsíc',preview:'Zkontrolovat fakturu',checking:'Kontrola…',create:'Vytvořit koncept',creating:'Vytváření…',empty:'Zatím žádné faktury.',send:'Odeslat zaměstnavateli',sending:'Odesílání…',cancel:'Zrušit fakturu',cancelling:'Rušení…',document:'Doklad / PDF',hours:'h',due:'Splatnost',draft:'Koncept',sent:'Odesláno',viewed:'Zobrazeno',paid:'Zaplaceno',cancelled:'Zrušeno',previewTitle:'Zkontrolujte fakturu',invoiceNumber:'Číslo',period:'Období',rate:'Sazba',total:'Celkem',seller:'Dodavatel',buyer:'Odběratel',close:'Zpět',sendConfirm:'Odeslat tuto fakturu zaměstnavateli? Po odeslání bude dostupná manažerovi.',cancelConfirm:'Zrušit tuto fakturu? Hodiny bude možné znovu použít v nové faktuře.'},
 en:{eyebrow:'Invoices',title:'My invoices',subtitle:'Create invoices only from approved hours.',month:'Month',preview:'Review invoice',checking:'Checking…',create:'Create draft',creating:'Creating…',empty:'No invoices yet.',send:'Send to employer',sending:'Sending…',cancel:'Cancel invoice',cancelling:'Cancelling…',document:'Document / PDF',hours:'h',due:'Due',draft:'Draft',sent:'Sent',viewed:'Viewed',paid:'Paid',cancelled:'Cancelled',previewTitle:'Review invoice',invoiceNumber:'Number',period:'Period',rate:'Rate',total:'Total due',seller:'Supplier',buyer:'Customer',close:'Back',sendConfirm:'Send this invoice to your employer? It will become visible to the manager.',cancelConfirm:'Cancel this invoice? Its hours will become available for a new invoice.'}
};
function currentMonth(){return new Date().toISOString().slice(0,7)}
function statusLabel(c,status){return c[String(status||'').toLowerCase()]||status}
function amount(value,currency){return `${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency||'CZK'}`}

export function InvoicesPage(){
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const [month,setMonth]=useState(currentMonth());
 const [error,setError]=useState('');
 const [preview,setPreview]=useState(null);
 const {data,isLoading,refetch}=useGetInvoicesQuery();
 const [getPreview,previewState]=useLazyGetInvoicePreviewQuery();
 const [createInvoice,createState]=useCreateInvoiceMutation();
 const [sendInvoice,sendState]=useSendInvoiceMutation();
 const [cancelInvoice,cancelState]=useCancelInvoiceMutation();
 const invoices=data?.invoices||[];

 async function review(){
  setError('');
  try{const result=await getPreview(month,true).unwrap();setPreview(result.preview||null)}catch(err){setError(getApiErrorMessage(err))}
 }
 async function create(){
  setError('');
  try{await createInvoice({month}).unwrap();setPreview(null);await refetch()}catch(err){setError(getApiErrorMessage(err))}
 }
 async function send(id){
  if(!window.confirm(c.sendConfirm))return;
  setError('');
  try{await sendInvoice(id).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}
 }
 async function cancel(id){
  if(!window.confirm(c.cancelConfirm))return;
  setError('');
  try{await cancelInvoice(id).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}
 }

 return <section className="invoicePage pageStack">
  <header className="invoiceHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <section className="invoiceCreate screenCard"><label><span>{c.month}</span><input type="month" value={month} max={currentMonth()} onChange={e=>setMonth(e.target.value)}/></label><button type="button" onClick={review} disabled={previewState.isFetching}>{previewState.isFetching?c.checking:c.preview}</button></section>
  {error?<p className="statusNote is-error">{error}</p>:null}
  <section className="invoiceList">{isLoading?<div className="screenCard">…</div>:invoices.length?invoices.map(invoice=><article className="invoiceCard screenCard" key={invoice.id}>
   <div className="invoiceCardTop"><div><span>{invoice.invoiceNumber}</span><strong>{Number(invoice.subtotal).toLocaleString()} {invoice.currency}</strong></div><span className={`invoiceStatus is-${String(invoice.status).toLowerCase()}`}>{statusLabel(c,invoice.status)}</span></div>
   <div className="invoiceMeta"><span>{invoice.periodStart} — {invoice.periodEnd}</span><span>{invoice.totalHours} {c.hours}</span><span>{c.due}: {invoice.dueDate}</span></div>
   <div className="invoiceActions">
    <button className="invoiceDocumentButton" type="button" onClick={()=>navigate(`/invoices/${invoice.id}`)}>{c.document}</button>
    {invoice.status==='DRAFT'?<button className="invoiceSend" type="button" disabled={sendState.isLoading} onClick={()=>send(invoice.id)}>{sendState.isLoading?c.sending:c.send}</button>:null}
    {['DRAFT','SENT','VIEWED'].includes(invoice.status)?<button className="invoiceCancel" type="button" disabled={cancelState.isLoading} onClick={()=>cancel(invoice.id)}>{cancelState.isLoading?c.cancelling:c.cancel}</button>:null}
   </div>
  </article>):<div className="invoiceEmpty screenCard">{c.empty}</div>}</section>

  {preview?<div className="invoiceModalBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPreview(null)}}>
   <section className="invoicePreviewModal screenCard" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title">
    <div className="invoicePreviewHeading"><div><p className="sectionEyebrow">{c.previewTitle}</p><h2 id="invoice-preview-title">{preview.invoiceNumber}</h2></div><button className="invoicePreviewClose" type="button" onClick={()=>setPreview(null)} aria-label={c.close}>×</button></div>
    <div className="invoicePreviewGrid">
     <div><span>{c.invoiceNumber}</span><strong>{preview.invoiceNumber}</strong></div>
     <div><span>{c.period}</span><strong>{preview.periodStart} — {preview.periodEnd}</strong></div>
     <div><span>{c.hours}</span><strong>{preview.totalHours}</strong></div>
     <div><span>{c.rate}</span><strong>{amount(preview.hourlyRate,preview.currency)} / h</strong></div>
     <div><span>{c.due}</span><strong>{preview.dueDate}</strong></div>
     <div className="invoicePreviewTotal"><span>{c.total}</span><strong>{amount(preview.subtotal,preview.currency)}</strong></div>
    </div>
    <div className="invoicePreviewParties"><div><span>{c.seller}</span><strong>{preview.seller?.businessName||'—'}</strong><small>{preview.seller?.ico||''}</small></div><div><span>{c.buyer}</span><strong>{preview.buyer?.name||'—'}</strong><small>{preview.buyer?.ico||''}</small></div></div>
    <div className="invoicePreviewActions"><button className="invoiceDocumentButton" type="button" onClick={()=>setPreview(null)}>{c.close}</button><button className="invoiceSend" type="button" onClick={create} disabled={createState.isLoading}>{createState.isLoading?c.creating:c.create}</button></div>
   </section>
  </div>:null}
 </section>;
}
