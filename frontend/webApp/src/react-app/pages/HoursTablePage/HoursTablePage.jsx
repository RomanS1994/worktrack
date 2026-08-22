import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetMonthlyHoursQuery } from '../../features/worktrack/monthlyHoursApi.js';
import './HoursTablePage.css';

const COPY={
 uk:{eyebrow:'Звіти',title:'Таблиця годин',subtitle:'Місячний огляд робочих годин, статусів і сум.',total:'Всього годин',approved:'Погоджено',pending:'Очікує',approvedAmount:'Підтверджено',pendingAmount:'Очікувана сума',date:'Дата',project:'Проєкт',hours:'Години',status:'Статус',empty:'У цьому місяці ще немає записів.',draft:'Чернетка',submitted:'Відправлено',approvedStatus:'Погоджено',rejected:'Повернено'},
 cs:{eyebrow:'Přehledy',title:'Tabulka hodin',subtitle:'Měsíční přehled pracovních hodin, stavů a částek.',total:'Celkem hodin',approved:'Schváleno',pending:'Čeká',approvedAmount:'Potvrzeno',pendingAmount:'Očekávaná částka',date:'Datum',project:'Projekt',hours:'Hodiny',status:'Stav',empty:'V tomto měsíci zatím nejsou žádné záznamy.',draft:'Koncept',submitted:'Odesláno',approvedStatus:'Schváleno',rejected:'Vráceno'},
 en:{eyebrow:'Reports',title:'Hours table',subtitle:'Monthly overview of work hours, statuses and amounts.',total:'Total hours',approved:'Approved',pending:'Pending',approvedAmount:'Confirmed',pendingAmount:'Expected amount',date:'Date',project:'Project',hours:'Hours',status:'Status',empty:'There are no entries in this month yet.',draft:'Draft',submitted:'Submitted',approvedStatus:'Approved',rejected:'Returned'}
};
function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function shiftMonth(value,amount){const [y,m]=value.split('-').map(Number);const d=new Date(y,m-1+amount,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(value,language){const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat(language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))}
function statusLabel(status,c){return status==='APPROVED'?c.approvedStatus:c[String(status||'DRAFT').toLowerCase()]||status}
function money(value){return `${new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:2}).format(Number(value||0))} Kč`}

export function HoursTablePage(){
 const {language}=useI18n();const c=COPY[language]||COPY.uk;const [month,setMonth]=useState(currentMonth);const {data,error,isFetching}=useGetMonthlyHoursQuery(month);const rows=data?.rows||[];const summary=data?.summary||{};const label=useMemo(()=>monthLabel(month,language),[month,language]);
 return <section className="hoursTablePage pageStack">
  <header className="hoursTableHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <section className="hoursTableMonth screenCard"><button type="button" onClick={()=>setMonth(shiftMonth(month,-1))}>←</button><strong>{label}</strong><button type="button" disabled={month>=currentMonth()} onClick={()=>setMonth(shiftMonth(month,1))}>→</button></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
  <section className="hoursTableSummary">
   <article><span>{c.total}</span><strong>{summary.totalHours||'0.00'} h</strong></article><article><span>{c.approved}</span><strong>{summary.approvedHours||'0.00'} h</strong></article><article><span>{c.pending}</span><strong>{summary.pendingHours||'0.00'} h</strong></article><article><span>{c.approvedAmount}</span><strong>{money(summary.approvedAmountCzk)}</strong></article><article><span>{c.pendingAmount}</span><strong>{money(summary.pendingAmountCzk)}</strong></article>
  </section>
  <section className="hoursTableCard screenCard">{isFetching?<p className="statusNote">Loading…</p>:rows.length?<div className="hoursTableScroll"><table><thead><tr><th>{c.date}</th><th>{c.project}</th><th>{c.hours}</th><th>{c.status}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.date}</td><td>{row.project||'—'}</td><td><strong>{row.hours} h</strong></td><td><span className={`hoursTableStatus is-${String(row.status).toLowerCase()}`}>{statusLabel(row.status,c)}</span></td></tr>)}</tbody></table></div>:<p className="hoursTableEmpty">{c.empty}</p>}</section>
 </section>;
}
