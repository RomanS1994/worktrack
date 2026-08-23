import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetMonthlyHoursQuery } from '../../features/worktrack/monthlyHoursApi.js';
import './HoursTablePage.css';

function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function shiftMonth(value,amount){const [y,m]=value.split('-').map(Number);const d=new Date(y,m-1+amount,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function monthLabel(value,language){const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat(localeFor(language),{month:'long',year:'numeric'}).format(new Date(y,m-1,1))}
function dateLabel(value,language){const d=new Date(`${value}T00:00:00Z`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat(localeFor(language),{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(d)}
function money(value,language){return `${new Intl.NumberFormat(localeFor(language),{maximumFractionDigits:2}).format(Number(value||0))} Kč`}

export function HoursTablePage(){
 const {language,t}=useI18n();const [month,setMonth]=useState(currentMonth);const {data,error,isFetching}=useGetMonthlyHoursQuery(month);const rows=data?.rows||[];const summary=data?.summary||{};const label=useMemo(()=>monthLabel(month,language),[month,language]);
 const statusLabel=status=>status==='APPROVED'?t('hoursTable.approvedStatus'):t(`hoursTable.${String(status||'DRAFT').toLowerCase()}`);
 return <section className="hoursTablePage pageStack">
  <header className="hoursTableHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('hoursTable.eyebrow')}</p><h1>{t('hoursTable.title')}</h1><p>{t('hoursTable.subtitle')}</p></div></header>
  <section className="hoursTableMonth screenCard"><button type="button" onClick={()=>setMonth(shiftMonth(month,-1))}>←</button><strong>{label}</strong><button type="button" disabled={month>=currentMonth()} onClick={()=>setMonth(shiftMonth(month,1))}>→</button></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
  <section className="hoursTableSummary">
   <article><span>{t('hoursTable.total')}</span><strong>{summary.totalHours||'0.00'} h</strong></article><article><span>{t('hoursTable.approved')}</span><strong>{summary.approvedHours||'0.00'} h</strong></article><article><span>{t('hoursTable.pending')}</span><strong>{summary.pendingHours||'0.00'} h</strong></article><article><span>{t('hoursTable.approvedAmount')}</span><strong>{money(summary.approvedAmountCzk,language)}</strong></article><article><span>{t('hoursTable.pendingAmount')}</span><strong>{money(summary.pendingAmountCzk,language)}</strong></article>
  </section>
  <section className="hoursTableCard screenCard">{isFetching?<p className="statusNote">{t('hoursTable.loading')}</p>:rows.length?<div className="hoursTableScroll"><table><thead><tr><th>{t('hoursTable.date')}</th><th>{t('hoursTable.project')}</th><th>{t('hoursTable.hours')}</th><th>{t('hoursTable.status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{dateLabel(row.date,language)}</td><td>{row.project||'—'}</td><td><strong>{row.hours} h</strong></td><td><span className={`hoursTableStatus is-${String(row.status).toLowerCase()}`}>{statusLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<p className="hoursTableEmpty">{t('hoursTable.empty')}</p>}</section>
 </section>;
}
