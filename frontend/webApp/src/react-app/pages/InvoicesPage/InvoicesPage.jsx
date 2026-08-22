import { useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useCreateInvoiceMutation, useGetInvoicesQuery, useSendInvoiceMutation } from '../../features/worktrack/billingApi.js';
import './InvoicesPage.css';

const COPY={
 uk:{eyebrow:'Фактури',title:'Мої фактури',subtitle:'Створюйте фактури лише з погоджених годин.',month:'Місяць',create:'Створити фактуру',creating:'Створення…',empty:'Фактур ще немає.',send:'Відправити роботодавцю',sending:'Відправлення…',hours:'год',due:'Оплатити до',draft:'Чернетка',sent:'Відправлено',viewed:'Переглянуто',paid:'Оплачено',cancelled:'Скасовано'},
 cs:{eyebrow:'Faktury',title:'Moje faktury',subtitle:'Vytvářejte faktury pouze ze schválených hodin.',month:'Měsíc',create:'Vytvořit fakturu',creating:'Vytváření…',empty:'Zatím žádné faktury.',send:'Odeslat zaměstnavateli',sending:'Odesílání…',hours:'h',due:'Splatnost',draft:'Koncept',sent:'Odesláno',viewed:'Zobrazeno',paid:'Zaplaceno',cancelled:'Zrušeno'},
 en:{eyebrow:'Invoices',title:'My invoices',subtitle:'Create invoices only from approved hours.',month:'Month',create:'Create invoice',creating:'Creating…',empty:'No invoices yet.',send:'Send to employer',sending:'Sending…',hours:'h',due:'Due',draft:'Draft',sent:'Sent',viewed:'Viewed',paid:'Paid',cancelled:'Cancelled'}
};
function currentMonth(){return new Date().toISOString().slice(0,7)}
function statusLabel(c,status){return c[String(status||'').toLowerCase()]||status}
export function InvoicesPage(){
 const {language}=useI18n();const c=COPY[language]||COPY.uk;const [month,setMonth]=useState(currentMonth());const [error,setError]=useState('');
 const {data,isLoading,refetch}=useGetInvoicesQuery();const [createInvoice,createState]=useCreateInvoiceMutation();const [sendInvoice,sendState]=useSendInvoiceMutation();
 const invoices=data?.invoices||[];
 async function create(){setError('');try{await createInvoice({month}).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}}
 async function send(id){setError('');try{await sendInvoice(id).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}}
 return <section className="invoicePage pageStack">
  <header className="invoiceHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <section className="invoiceCreate screenCard"><label><span>{c.month}</span><input type="month" value={month} max={currentMonth()} onChange={e=>setMonth(e.target.value)}/></label><button type="button" onClick={create} disabled={createState.isLoading}>{createState.isLoading?c.creating:c.create}</button></section>
  {error?<p className="statusNote is-error">{error}</p>:null}
  <section className="invoiceList">{isLoading?<div className="screenCard">…</div>:invoices.length?invoices.map(invoice=><article className="invoiceCard screenCard" key={invoice.id}>
   <div className="invoiceCardTop"><div><span>{invoice.invoiceNumber}</span><strong>{Number(invoice.subtotal).toLocaleString()} {invoice.currency}</strong></div><span className={`invoiceStatus is-${String(invoice.status).toLowerCase()}`}>{statusLabel(c,invoice.status)}</span></div>
   <div className="invoiceMeta"><span>{invoice.periodStart} — {invoice.periodEnd}</span><span>{invoice.totalHours} {c.hours}</span><span>{c.due}: {invoice.dueDate}</span></div>
   {invoice.status==='DRAFT'?<button className="invoiceSend" type="button" disabled={sendState.isLoading} onClick={()=>send(invoice.id)}>{sendState.isLoading?c.sending:c.send}</button>:null}
  </article>):<div className="invoiceEmpty screenCard">{c.empty}</div>}</section>
 </section>;
}
