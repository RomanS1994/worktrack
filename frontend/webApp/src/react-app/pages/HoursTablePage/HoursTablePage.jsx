import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { getPageLocale, getPageMessage } from '@shared/app/i18n/worktrackPageMessages.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetMonthlyHoursQuery } from '../../features/worktrack/monthlyHoursApi.js';
import './HoursTablePage.css';

function currentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function shiftMonth(value,amount){const [y,m]=value.split('-').map(Number);const d=new Date(y,m-1+amount,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(value,locale){const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(y,m-1,1))}
function dateLabel(value,locale){const d=new Date(`${value}T00:00:00Z`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(d)}
function money(value,locale){return `${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(Number(value||0))} Kč`}

export function HoursTablePage(){
 const {language}=useI18n();const t=(key,values)=>getPageMessage(language,`hoursTable.${key}`,values);const locale=getPageLocale(language);const [month,setMonth]=useState(currentMonth);const {data,error,isFetching}=useGetMonthlyHoursQuery(month);const rows=data?.rows||[];const summary=data?.summary||{};const label=useMemo(()=>monthLabel(month,locale),[month,locale]);
 const statusLabel=status=>status==='APPROVED'?t('approvedStatus'):t(String(status||'DRAFT').toLowerCase());
 return <section className="hoursTablePage pageStack">
  <header className="hoursTableHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('subtitle')}</p></div></header>
  <section className="hoursTableMonth screenCard"><button type="button" onClick={()=>setMonth(shiftMonth(month,-1))} aria-label="Previous month">←</button><strong>{label}</strong><button type="button" disabled={month>=currentMonth()} onClick={()=>setMonth(shiftMonth(month,1))} aria-label="Next month">→</button></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
  <section className="hoursTableSummary">
   <article><span>{t('total')}</span><strong>{summary.totalHours||'0.00'} h</strong></article><article><span>{t('approved')}</span><strong>{summary.approvedHours||'0.00'} h</strong></article><article><span>{t('pending')}</span><strong>{summary.pendingHours||'0.00'} h</strong></article><article><span>{t('approvedAmount')}</span><strong>{money(summary.approvedAmountCzk,locale)}</strong></article><article><span>{t('pendingAmount')}</span><strong>{money(summary.pendingAmountCzk,locale)}</strong></article>
  </section>
  <section className="hoursTableCard screenCard">{isFetching?<p className="statusNote">{t('loading')}</p>:rows.length?<div className="hoursTableScroll"><table><thead><tr><th>{t('date')}</th><th>{t('project')}</th><th>{t('hours')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{dateLabel(row.date,locale)}</td><td>{row.project||'—'}</td><td><strong>{row.hours} h</strong></td><td><span className={`hoursTableStatus is-${String(row.status).toLowerCase()}`}>{statusLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<p className="hoursTableEmpty">{t('empty')}</p>}</section>
 </section>;
}
