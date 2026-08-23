import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetManagerInvoicesQuery, useMarkInvoicePaidMutation } from '../../features/worktrack/billingApi.js';
import './ManagerInvoicesPage.css';

const COPY={
 uk:{eyebrow:'Фактури',title:'Фактури працівників',subtitle:'Отримані фактури та статус оплати.',empty:'Фактур ще немає.',document:'Документ / PDF',paid:'Позначити оплачено',paying:'Збереження…',hours:'год',due:'Оплатити до',draft:'Чернетка',sent:'Відправлено',viewed:'Переглянуто',paidStatus:'Оплачено',cancelled:'Скасовано'},
 cs:{eyebrow:'Faktury',title:'Faktury pracovníků',subtitle:'Přijaté faktury a stav plateb.',empty:'Zatím žádné faktury.',document:'Doklad / PDF',paid:'Označit jako zaplacené',paying:'Ukládání…',hours:'h',due:'Splatnost',draft:'Koncept',sent:'Odesláno',viewed:'Zobrazeno',paidStatus:'Zaplaceno',cancelled:'Zrušeno'},
 en:{eyebrow:'Invoices',title:'Employee invoices',subtitle:'Received invoices and payment status.',empty:'No invoices yet.',document:'Document / PDF',paid:'Mark as paid',paying:'Saving…',hours:'h',due:'Due',draft:'Draft',sent:'Sent',viewed:'Viewed',paidStatus:'Paid',cancelled:'Cancelled'}
};
function statusLabel(c,status){if(status==='PAID')return c.paidStatus;return c[String(status||'').toLowerCase()]||status}
export function ManagerInvoicesPage(){
 const navigate=useNavigate();const {language}=useI18n();const c=COPY[language]||COPY.uk;const [error,setError]=useState('');const {data,isLoading,refetch}=useGetManagerInvoicesQuery();const [markPaid,state]=useMarkInvoicePaidMutation();const invoices=data?.invoices||[];
 async function paid(id){setError('');try{await markPaid(id).unwrap();await refetch()}catch(err){setError(getApiErrorMessage(err))}}
 return <section className="managerInvoicePage pageStack"><header className="managerInvoiceHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>{error?<p className="statusNote is-error">{error}</p>:null}<section className="managerInvoiceList">{isLoading?<div className="screenCard">…</div>:invoices.length?invoices.map(invoice=><article className="managerInvoiceCard screenCard" key={invoice.id}><div className="managerInvoiceTop"><div><span>{invoice.employee?.name||invoice.employee?.email}</span><strong>{invoice.invoiceNumber}</strong></div><div className="managerInvoiceAmount"><strong>{Number(invoice.subtotal).toLocaleString()} {invoice.currency}</strong><span className={`invoiceStatus is-${String(invoice.status).toLowerCase()}`}>{statusLabel(c,invoice.status)}</span></div></div><div className="managerInvoiceMeta"><span>{invoice.periodStart} — {invoice.periodEnd}</span><span>{invoice.totalHours} {c.hours}</span><span>{c.due}: {invoice.dueDate}</span></div><div className="managerInvoiceActions"><button className="managerInvoiceDocument" type="button" onClick={()=>navigate(`/manager/invoices/${invoice.id}`)}>{c.document}</button>{['SENT','VIEWED'].includes(invoice.status)?<button type="button" onClick={()=>paid(invoice.id)} disabled={state.isLoading}>{state.isLoading?c.paying:c.paid}</button>:null}</div></article>):<div className="screenCard managerInvoiceEmpty">{c.empty}</div>}</section></section>;
}
