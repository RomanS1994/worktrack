import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { getPageLocale, getPageMessage } from '@shared/app/i18n/worktrackPageMessages.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useCreateWorkEntryMutation, useDeleteWorkEntryMutation, useGetProjectsQuery, useGetWeekEntriesQuery, useSubmitWeekMutation, useUpdateWorkEntryMutation } from '../../features/worktrack/worktrackApi.js';
import './FastHoursPage.css';

const DAY_MS=86400000;
function dateKey(d){return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())).toISOString().slice(0,10)}
function weekStartNow(){const d=new Date();const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return dateKey(d)}
function weekStartForDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';const d=new Date(`${value}T00:00:00Z`);if(Number.isNaN(d.getTime()))return '';const day=d.getUTCDay();return new Date(d.getTime()+(day===0?-6:1-day)*DAY_MS).toISOString().slice(0,10)}
function initialWeek(current){return weekStartForDate(new URLSearchParams(window.location.search).get('date'))||current}
function shiftWeek(key,n){return new Date(new Date(`${key}T00:00:00Z`).getTime()+n*7*DAY_MS).toISOString().slice(0,10)}
function fmt(value,locale){return new Intl.DateTimeFormat(locale,{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)).replace('.','')}
export function FastHoursPage(){
 const {language}=useI18n();const t=(key,values)=>getPageMessage(language,`fastHours.${key}`,values);const locale=getPageLocale(language);const navigate=useNavigate();const current=useMemo(weekStartNow,[]);const [weekStart,setWeekStart]=useState(()=>initialWeek(current));
 const {data,error,isFetching}=useGetWeekEntriesQuery({weekStart});const projectsQuery=useGetProjectsQuery();
 const projects=(projectsQuery.data?.projects||[]).filter(p=>p.isActive);const [projectId,setProjectId]=useState('');const selectedProjectId=projectId||projects[0]?.id||'';
 const [draft,setDraft]=useState({});const [message,setMessage]=useState('');const [actionError,setActionError]=useState('');
 const [createEntry,createState]=useCreateWorkEntryMutation();const [updateEntry,updateState]=useUpdateWorkEntryMutation();const [deleteEntry,deleteState]=useDeleteWorkEntryMutation();const [submitWeek,submitState]=useSubmitWeekMutation();
 const days=data?.week?.days||[];const entries=data?.entries||[];const status=data?.submission?.status||'DRAFT';const locked=status==='SUBMITTED'||status==='APPROVED';const busy=isFetching||createState.isLoading||updateState.isLoading||deleteState.isLoading||submitState.isLoading;
 const values=useMemo(()=>Object.fromEntries(days.map(day=>{const existing=entries.find(e=>e.workDate===day.date&&e.projectId===selectedProjectId);return [day.date,draft[day.date]??(existing?.hours||'')]})),[days,entries,selectedProjectId,draft]);
 const total=Object.values(values).reduce((sum,v)=>sum+(Number(v)||0),0);const statusText=t(status.toLowerCase());
 const setHour=(date,value)=>{setMessage('');setActionError('');setDraft(v=>({...v,[date]:value}))};const weekdayPreset=()=>setDraft(Object.fromEntries(days.map((day,i)=>[day.date,i<5?'8':''])));const clear=()=>setDraft(Object.fromEntries(days.map(day=>[day.date,''])));
 async function save(){if(!selectedProjectId||locked)return;setMessage('');setActionError('');try{for(const day of days){const value=String(values[day.date]??'').trim();const hours=Number(value)||0;const existing=entries.find(e=>e.workDate===day.date&&e.projectId===selectedProjectId);if(existing&&hours<=0)await deleteEntry(existing.id).unwrap();else if(existing)await updateEntry({entryId:existing.id,hours:String(hours),projectId:selectedProjectId}).unwrap();else if(hours>0)await createEntry({workDate:day.date,hours:String(hours),projectId:selectedProjectId}).unwrap()}setDraft({});setMessage(t('saved'))}catch(err){setActionError(getApiErrorMessage(err));throw err}}
 async function send(){setActionError('');try{await save();await submitWeek({weekStart}).unwrap()}catch(err){setActionError(getApiErrorMessage(err))}}
 return <section className="fastHoursPage pageStack">
  <header className="fastHoursHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{total.toFixed(2)} h · {statusText}</p></div><span className={`fastHoursStatus is-${status.toLowerCase()}`}>{statusText}</span></header>
  <section className="fastWeekBar screenCard"><button type="button" disabled={busy} onClick={()=>{setDraft({});setWeekStart(shiftWeek(weekStart,-1))}}>← {t('previous')}</button><div><strong>{days.length?`${fmt(days[0].date,locale)} — ${fmt(days[days.length-1].date,locale)}`:t('thisWeek')}</strong><span>{weekStart===current?t('thisWeek'):''}</span></div><button type="button" disabled={busy||weekStart>=current} onClick={()=>{setDraft({});setWeekStart(shiftWeek(weekStart,1))}}>{t('next')} →</button></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
  <section className="fastEntryCard screenCard">
   <label className="fastProject"><span>{t('project')}</span><select value={selectedProjectId} disabled={locked||busy||!projects.length} onChange={e=>{setDraft({});setProjectId(e.target.value)}}>{!projects.length?<option value="">{t('noProjects')}</option>:null}{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <div className="fastActions"><span>{t('quick')}</span><button type="button" disabled={locked||busy} onClick={weekdayPreset}>{t('weekday')}</button><button type="button" disabled={locked||busy} onClick={clear}>{t('clear')}</button></div>
   <div className="fastDays">{days.map(day=><label className="fastDay" key={day.date}><div><strong>{fmt(day.date,locale)}</strong></div><div className="fastHourInput"><input aria-label={`${t('hours')} ${day.date}`} inputMode="decimal" type="number" min="0" max="24" step="0.25" disabled={locked||busy} placeholder="—" value={values[day.date]??''} onChange={e=>setHour(day.date,e.target.value)}/><span>h</span></div></label>)}</div>
   <div className="fastTotal"><span>{t('total')}</span><strong>{total.toFixed(2)} h</strong></div>
   {locked?<p className="statusNote">{t('locked')}</p>:null}{message?<p className="statusNote is-success">{message}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}
   <button className="fastSave" type="button" disabled={locked||busy||!selectedProjectId} onClick={save}>{busy?t('saving'):t('save')}</button>
  </section>
  <button className="fastSend" type="button" disabled={locked||busy||(!entries.length&&total<=0)} onClick={send}>{t('send')} →</button>
  <button className="fastAdvanced screenCard" type="button" onClick={()=>navigate(`/hours-advanced?date=${weekStart}`)}><strong>{t('advanced')}</strong><span>{t('advancedCopy')}</span><b>›</b></button>
 </section>;
}
