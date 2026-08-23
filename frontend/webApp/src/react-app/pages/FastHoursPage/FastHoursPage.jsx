import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useGetProjectsQuery,
  useGetWeekEntriesQuery,
  useSubmitWeekMutation,
  useUpdateWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './FastHoursPage.css';

const DAY_MS = 86400000;
const COPY = {
  uk: {
    project: 'Об’єкт / проєкт', addShift: 'Додати зміну', editShift: 'Редагувати зміну', from: 'Від', to: 'До', total: 'Разом', note: 'Нотатка', notePlaceholder: 'Наприклад: монтаж, сервіс, додаткові роботи…', saveShift: 'Зберегти зміну', deleteShift: 'Видалити зміну', quickTitle: 'Швидке заповнення', quickCopy: 'Створіть однакову зміну для вибраних днів.', apply: 'Застосувати до вибраних днів', selectDays: 'Виберіть хоча б один день', invalidTime: 'Перевірте час початку та завершення', weekTotal: 'Разом за тиждень', overtime: 'Понаднормово', autoSaved: 'Збережено автоматично', noShift: 'Додати зміну', submit: 'Відправити тиждень менеджеру', locked: 'Тиждень уже відправлено або погоджено. Редагування заблоковано.', noProjects: 'Немає активних об’єктів', saved: 'Зміну збережено', quickSaved: 'Тиждень оновлено', close: 'Закрити', thisWeek: 'Цей тиждень', previous: 'Попередній', next: 'Наступний', status: { DRAFT:'Чернетка', SUBMITTED:'Відправлено', APPROVED:'Погоджено', REJECTED:'Відхилено' }
  },
  cs: {
    project: 'Objekt / projekt', addShift: 'Přidat směnu', editShift: 'Upravit směnu', from: 'Od', to: 'Do', total: 'Celkem', note: 'Poznámka', notePlaceholder: 'Např. montáž, servis, vícepráce…', saveShift: 'Uložit směnu', deleteShift: 'Smazat směnu', quickTitle: 'Rychlé vyplnění', quickCopy: 'Vytvořte stejnou směnu pro vybrané dny.', apply: 'Použít na vybrané dny', selectDays: 'Vyberte alespoň jeden den', invalidTime: 'Zkontrolujte čas začátku a konce', weekTotal: 'Celkem za týden', overtime: 'Přesčas', autoSaved: 'Uloženo automaticky', noShift: 'Přidat směnu', submit: 'Odeslat týden manažerovi', locked: 'Týden už byl odeslán nebo schválen. Úpravy jsou uzamčeny.', noProjects: 'Žádné aktivní objekty', saved: 'Směna uložena', quickSaved: 'Týden aktualizován', close: 'Zavřít', thisWeek: 'Tento týden', previous: 'Předchozí', next: 'Další', status: { DRAFT:'Koncept', SUBMITTED:'Odesláno', APPROVED:'Schváleno', REJECTED:'Zamítnuto' }
  },
  en: {
    project: 'Project / site', addShift: 'Add shift', editShift: 'Edit shift', from: 'From', to: 'To', total: 'Total', note: 'Note', notePlaceholder: 'For example: installation, service, extra work…', saveShift: 'Save shift', deleteShift: 'Delete shift', quickTitle: 'Quick fill', quickCopy: 'Create the same shift for selected days.', apply: 'Apply to selected days', selectDays: 'Select at least one day', invalidTime: 'Check the start and end time', weekTotal: 'Week total', overtime: 'Overtime', autoSaved: 'Saved automatically', noShift: 'Add shift', submit: 'Send week to manager', locked: 'This week has already been submitted or approved. Editing is locked.', noProjects: 'No active projects', saved: 'Shift saved', quickSaved: 'Week updated', close: 'Close', thisWeek: 'This week', previous: 'Previous', next: 'Next', status: { DRAFT:'Draft', SUBMITTED:'Submitted', APPROVED:'Approved', REJECTED:'Rejected' }
  }
};

function dateKey(d){return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())).toISOString().slice(0,10)}
function weekStartNow(){const d=new Date();const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return dateKey(d)}
function weekStartForDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';const d=new Date(`${value}T00:00:00Z`);if(Number.isNaN(d.getTime()))return '';const day=d.getUTCDay();return new Date(d.getTime()+(day===0?-6:1-day)*DAY_MS).toISOString().slice(0,10)}
function initialWeek(current){return weekStartForDate(new URLSearchParams(window.location.search).get('date'))||current}
function shiftWeek(key,n){return new Date(new Date(`${key}T00:00:00Z`).getTime()+n*7*DAY_MS).toISOString().slice(0,10)}
function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function fmt(value,language){return new Intl.DateTimeFormat(localeFor(language),{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)).replace('.','')}
function fmtLong(value,language){return new Intl.DateTimeFormat(localeFor(language),{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))}
function timeToMinutes(value){if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);if(h>23||m>59)return null;return h*60+m}
function calculateHours(start,end){const startMinutes=timeToMinutes(start);let endMinutes=timeToMinutes(end);if(startMinutes==null||endMinutes==null)return 0;if(endMinutes<=startMinutes)endMinutes+=1440;return Math.round(((endMinutes-startMinutes)/60)*100)/100}
function formatHours(value){const minutes=Math.round((Number(value)||0)*60);return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`}
function dayEntries(entries,date){return entries.filter(entry=>entry.workDate===date).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')))}
function getDayTotal(entries,date){return dayEntries(entries,date).reduce((sum,entry)=>sum+(Number(entry.hours)||0),0)}

export function FastHoursPage(){
  const {language,t}=useI18n();
  const c=COPY[language]||COPY.uk;
  const current=useMemo(weekStartNow,[]);
  const [weekStart,setWeekStart]=useState(()=>initialWeek(current));
  const {data,error,isFetching}=useGetWeekEntriesQuery({weekStart});
  const projectsQuery=useGetProjectsQuery();
  const projects=(projectsQuery.data?.projects||[]).filter(project=>project.isActive);
  const [createEntry,createState]=useCreateWorkEntryMutation();
  const [updateEntry,updateState]=useUpdateWorkEntryMutation();
  const [deleteEntry,deleteState]=useDeleteWorkEntryMutation();
  const [submitWeek,submitState]=useSubmitWeekMutation();
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingId,setEditingId]=useState('');
  const [editingDate,setEditingDate]=useState('');
  const [projectId,setProjectId]=useState('');
  const [startTime,setStartTime]=useState('07:00');
  const [endTime,setEndTime]=useState('15:30');
  const [note,setNote]=useState('');
  const [quickOpen,setQuickOpen]=useState(false);
  const [quickProject,setQuickProject]=useState('');
  const [quickStart,setQuickStart]=useState('07:00');
  const [quickEnd,setQuickEnd]=useState('15:30');
  const [selectedDays,setSelectedDays]=useState([0,1,2,3,4]);
  const [message,setMessage]=useState('');
  const [actionError,setActionError]=useState('');

  const days=data?.week?.days||[];
  const entries=data?.entries||[];
  const status=data?.submission?.status||'DRAFT';
  const locked=status==='SUBMITTED'||status==='APPROVED';
  const busy=isFetching||createState.isLoading||updateState.isLoading||deleteState.isLoading||submitState.isLoading;
  const weekTotal=entries.reduce((sum,entry)=>sum+(Number(entry.hours)||0),0);
  const overtime=days.reduce((sum,day)=>sum+Math.max(0,getDayTotal(entries,day.date)-8),0);
  const calculatedHours=calculateHours(startTime,endTime);
  const quickHours=calculateHours(quickStart,quickEnd);
  const selectedProject=projectId||projects[0]?.id||'';
  const selectedQuickProject=quickProject||projects[0]?.id||'';

  function resetMessages(){setMessage('');setActionError('')}
  function openNew(date){resetMessages();setEditingId('');setEditingDate(date);setProjectId(projects[0]?.id||'');setStartTime('07:00');setEndTime('15:30');setNote('');setEditorOpen(true)}
  function openExisting(entry){resetMessages();setEditingId(entry.id);setEditingDate(entry.workDate);setProjectId(entry.projectId||entry.project?.id||'');setStartTime(entry.startTime||'07:00');setEndTime(entry.endTime||'15:30');setNote(entry.note||'');setEditorOpen(true)}
  function changeWeek(amount){setEditorOpen(false);setQuickOpen(false);setWeekStart(shiftWeek(weekStart,amount))}

  async function saveShift(event){
    event.preventDefault();
    if(locked||!selectedProject||calculatedHours<=0){setActionError(c.invalidTime);return}
    resetMessages();
    const payload={projectId:selectedProject,startTime,endTime,note,hours:String(calculatedHours)};
    try{
      if(editingId){
        await updateEntry({entryId:editingId,...payload}).unwrap();
      }else{
        const sameProject=entries.find(entry=>entry.workDate===editingDate&&entry.projectId===selectedProject);
        if(sameProject)await updateEntry({entryId:sameProject.id,...payload}).unwrap();
        else await createEntry({workDate:editingDate,...payload}).unwrap();
      }
      setEditorOpen(false);setMessage(c.saved);
    }catch(err){setActionError(getApiErrorMessage(err))}
  }

  async function removeShift(){
    if(!editingId||locked)return;
    resetMessages();
    try{await deleteEntry(editingId).unwrap();setEditorOpen(false);setMessage(c.saved)}catch(err){setActionError(getApiErrorMessage(err))}
  }

  function toggleDay(index){setSelectedDays(currentDays=>currentDays.includes(index)?currentDays.filter(day=>day!==index):[...currentDays,index].sort())}

  async function applyQuickFill(){
    resetMessages();
    if(!selectedDays.length){setActionError(c.selectDays);return}
    if(!selectedQuickProject||quickHours<=0){setActionError(c.invalidTime);return}
    try{
      for(const index of selectedDays){
        const day=days[index]; if(!day)continue;
        const payload={projectId:selectedQuickProject,startTime:quickStart,endTime:quickEnd,note:'',hours:String(quickHours)};
        const existing=entries.find(entry=>entry.workDate===day.date&&entry.projectId===selectedQuickProject);
        if(existing)await updateEntry({entryId:existing.id,...payload}).unwrap();
        else await createEntry({workDate:day.date,...payload}).unwrap();
      }
      setQuickOpen(false);setMessage(c.quickSaved);
    }catch(err){setActionError(getApiErrorMessage(err))}
  }

  async function send(){resetMessages();try{await submitWeek({weekStart}).unwrap()}catch(err){setActionError(getApiErrorMessage(err))}}

  return <section className="fastHoursPage pageStack">
    <header className="fastHoursHeader appTop">
      <div className="appTitleBlock"><p className="sectionEyebrow">{t('fastHours.eyebrow')}</p><h1>{t('fastHours.title')}</h1><p>{formatHours(weekTotal)} · {c.status[status]||status}</p></div>
      <span className={`fastHoursStatus is-${status.toLowerCase()}`}>{c.status[status]||status}</span>
    </header>

    <section className="fastWeekBar screenCard">
      <button type="button" disabled={busy} aria-label={c.previous} onClick={()=>changeWeek(-1)}>←</button>
      <div><strong>{days.length?`${fmt(days[0].date,language)} — ${fmt(days[days.length-1].date,language)}`:c.thisWeek}</strong><span>{weekStart===current?c.thisWeek:''}</span></div>
      <button type="button" disabled={busy||weekStart>=current} aria-label={c.next} onClick={()=>changeWeek(1)}>→</button>
    </section>

    {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
    {locked?<p className="statusNote">{c.locked}</p>:null}

    <section className="fastShiftCard screenCard">
      <div className="fastShiftCardTop">
        <div><strong>{projects[0]?.name||c.project}</strong><span>{c.autoSaved}</span></div>
        <button type="button" disabled={locked||busy||!projects.length} onClick={()=>setQuickOpen(value=>!value)}>＋ {c.quickTitle}</button>
      </div>

      {quickOpen?<div className="fastQuickFill">
        <div className="fastQuickHeading"><div><strong>{c.quickTitle}</strong><span>{c.quickCopy}</span></div></div>
        <label><span>{c.project}</span><select value={selectedQuickProject} onChange={e=>setQuickProject(e.target.value)}>{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        <div className="fastQuickTimes"><label><span>{c.from}</span><input type="time" value={quickStart} onChange={e=>setQuickStart(e.target.value)}/></label><label><span>{c.to}</span><input type="time" value={quickEnd} onChange={e=>setQuickEnd(e.target.value)}/></label></div>
        <div className="fastQuickDays">{days.map((day,index)=><button type="button" className={selectedDays.includes(index)?'is-active':''} onClick={()=>toggleDay(index)} key={day.date}>{new Intl.DateTimeFormat(localeFor(language),{weekday:'short',timeZone:'UTC'}).format(new Date(`${day.date}T00:00:00Z`)).replace('.','')}</button>)}</div>
        <div className="fastQuickSummary"><span>{c.total}</span><strong>{formatHours(quickHours)}</strong></div>
        <button className="fastQuickApply" type="button" disabled={busy||locked} onClick={applyQuickFill}>{c.apply}</button>
      </div>:null}

      <div className="fastShiftDays">
        {days.map(day=>{
          const items=dayEntries(entries,day.date);
          const dayTotal=getDayTotal(entries,day.date);
          return <article className="fastShiftDay" key={day.date}>
            <div className="fastShiftDate"><strong>{fmt(day.date,language)}</strong>{dayTotal>8?<span>+{formatHours(dayTotal-8)} {c.overtime.toLowerCase()}</span>:null}</div>
            <div className="fastShiftItems">
              {items.length?items.map(entry=><button type="button" className="fastShiftItem" key={entry.id} disabled={locked||busy} onClick={()=>openExisting(entry)}>
                <span className={`fastShiftDot status-${String(entry.status||'DRAFT').toLowerCase()}`}/>
                <span className="fastShiftInfo"><strong>{entry.startTime&&entry.endTime?`${entry.startTime} — ${entry.endTime}`:formatHours(entry.hours)}</strong><small>{entry.project?.name||c.project}{entry.note?` · ${entry.note}`:''}</small></span>
                <b>{formatHours(entry.hours)}</b><i>›</i>
              </button>):null}
              {!locked?<button className="fastAddShift" type="button" disabled={busy||!projects.length} onClick={()=>openNew(day.date)}>＋ {c.noShift}</button>:null}
            </div>
          </article>
        })}
      </div>
    </section>

    <section className="fastWeekSummary screenCard"><div><span>{c.weekTotal}</span><strong>{formatHours(weekTotal)}</strong></div><div><span>{c.overtime}</span><strong className={overtime>0?'is-overtime':''}>{formatHours(overtime)}</strong></div></section>
    {message?<p className="statusNote is-success">{message}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}
    <div className="fastAutosave">✓ {c.autoSaved}</div>
    <button className="fastSend" type="button" disabled={locked||busy||!entries.length} onClick={send}>{c.submit} →</button>

    {editorOpen?<div className="fastShiftModalBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditorOpen(false)}}>
      <section className="fastShiftModal" role="dialog" aria-modal="true" aria-label={editingId?c.editShift:c.addShift}>
        <header><div><span>{fmtLong(editingDate,language)}</span><h2>{editingId?c.editShift:c.addShift}</h2></div><button type="button" aria-label={c.close} onClick={()=>setEditorOpen(false)}>×</button></header>
        <form className="fastShiftForm" onSubmit={saveShift}>
          <label><span>{c.project}</span><select value={selectedProject} onChange={e=>setProjectId(e.target.value)} disabled={locked||busy}>{!projects.length?<option value="">{c.noProjects}</option>:null}{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
          <div className="fastShiftTimeGrid"><label><span>{c.from}</span><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} disabled={locked||busy}/></label><label><span>{c.to}</span><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} disabled={locked||busy}/></label></div>
          <div className="fastShiftCalculated"><span>{c.total}</span><strong>{formatHours(calculatedHours)}</strong></div>
          <label><span>{c.note}</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={c.notePlaceholder} disabled={locked||busy}/></label>
          {actionError?<p className="statusNote is-error">{actionError}</p>:null}
          <button className="fastShiftSave" type="submit" disabled={locked||busy||!selectedProject||calculatedHours<=0}>{c.saveShift}</button>
          {editingId?<button className="fastShiftDelete" type="button" disabled={locked||busy} onClick={removeShift}>{c.deleteShift}</button>:null}
        </form>
      </section>
    </div>:null}
  </section>;
}
