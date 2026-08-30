import { useMemo, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useGetDefaultProjectQuery,
  useGetProjectsQuery,
  useGetWeekEntriesQuery,
  useGetWorkRulesQuery,
  useSubmitWeekMutation,
  useUpdateDefaultProjectMutation,
  useUpdateWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './FastHoursPage.css';
import './FastHoursPage.compact.css';
import './FastHoursPage.defaultProject.css';

const DAY_MS = 86400000;
const COPY = {
  uk: { project:'Об’єкт / проєкт',addShift:'Додати зміну',editShift:'Редагувати зміну',from:'Від',to:'До',total:'Разом',note:'Нотатка',notePlaceholder:'Наприклад: монтаж, сервіс, додаткові роботи…',saveShift:'Зберегти зміну',deleteShift:'Видалити зміну',quickTitle:'Швидке заповнення тижня',quickCopy:'Заповнити робочі дні за графіком',apply:'Застосувати до вибраних днів',selectDays:'Виберіть хоча б один день',invalidTime:'Перевірте час початку та завершення',weekTotal:'Чисті години за тиждень',overtime:'Понаднормово',autoSaved:'Основний об’єкт',noShift:'Немає зміни',submit:'Відправити тиждень менеджеру',locked:'Тиждень уже відправлено або погоджено. Редагування заблоковано.',noProjects:'Немає активних об’єктів',saved:'Зміну збережено',quickSaved:'Тиждень оновлено',close:'Закрити',thisWeek:'Цей тиждень',previous:'Попередній',next:'Наступний',gross:'Фактично',break:'Обід',net:'Чистими',norm:'Норма',myHours:'Мої години',weeklyNorm:'год норми',choosePrimary:'Виберіть основний об’єкт',defaultSaved:'Основний об’єкт змінено',primary:'Основний',status:{DRAFT:'Чернетка',SUBMITTED:'Відправлено',APPROVED:'Погоджено',REJECTED:'Відхилено'} },
  cs: { project:'Objekt / projekt',addShift:'Přidat směnu',editShift:'Upravit směnu',from:'Od',to:'Do',total:'Celkem',note:'Poznámka',notePlaceholder:'Např. montáž, servis, vícepráce…',saveShift:'Uložit směnu',deleteShift:'Smazat směnu',quickTitle:'Rychlé vyplnění týdne',quickCopy:'Vyplnit pracovní dny podle rozvrhu',apply:'Použít na vybrané dny',selectDays:'Vyberte alespoň jeden den',invalidTime:'Zkontrolujte čas začátku a konce',weekTotal:'Čisté hodiny za týden',overtime:'Přesčas',autoSaved:'Hlavní objekt',noShift:'Bez směny',submit:'Odeslat týden manažerovi',locked:'Týden už byl odeslán nebo schválen. Úpravy jsou uzamčeny.',noProjects:'Žádné aktivní objekty',saved:'Směna uložena',quickSaved:'Týden aktualizován',close:'Zavřít',thisWeek:'Tento týden',previous:'Předchozí',next:'Další',gross:'Skutečně',break:'Oběd',net:'Čisté',norm:'Norma',myHours:'Moje hodiny',weeklyNorm:'hod normy',choosePrimary:'Vyberte hlavní objekt',defaultSaved:'Hlavní objekt byl změněn',primary:'Hlavní',status:{DRAFT:'Koncept',SUBMITTED:'Odesláno',APPROVED:'Schváleno',REJECTED:'Zamítnuto'} },
  en: { project:'Project / site',addShift:'Add shift',editShift:'Edit shift',from:'From',to:'To',total:'Total',note:'Note',notePlaceholder:'For example: installation, service, extra work…',saveShift:'Save shift',deleteShift:'Delete shift',quickTitle:'Quick fill week',quickCopy:'Fill workdays from a schedule',apply:'Apply to selected days',selectDays:'Select at least one day',invalidTime:'Check the start and end time',weekTotal:'Net hours this week',overtime:'Overtime',autoSaved:'Primary site',noShift:'No shift',submit:'Send week to manager',locked:'This week has already been submitted or approved. Editing is locked.',noProjects:'No active projects',saved:'Shift saved',quickSaved:'Week updated',close:'Close',thisWeek:'This week',previous:'Previous',next:'Next',gross:'Gross',break:'Lunch',net:'Net',norm:'Standard',myHours:'My hours',weeklyNorm:'h target',choosePrimary:'Choose primary site',defaultSaved:'Primary site updated',primary:'Primary',status:{DRAFT:'Draft',SUBMITTED:'Submitted',APPROVED:'Approved',REJECTED:'Rejected'} }
};

function dateKey(d){return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())).toISOString().slice(0,10)}
function weekStartNow(){const d=new Date();const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return dateKey(d)}
function weekStartForDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';const d=new Date(`${value}T00:00:00Z`);if(Number.isNaN(d.getTime()))return '';const day=d.getUTCDay();return new Date(d.getTime()+(day===0?-6:1-day)*DAY_MS).toISOString().slice(0,10)}
function initialWeek(current){return weekStartForDate(new URLSearchParams(window.location.search).get('date'))||current}
function shiftWeek(key,n){return new Date(new Date(`${key}T00:00:00Z`).getTime()+n*7*DAY_MS).toISOString().slice(0,10)}
function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function fmtLong(value,language){return new Intl.DateTimeFormat(localeFor(language),{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))}
function fmtWeekRange(days,language){if(!days.length)return '';const options={day:'numeric',month:'long',timeZone:'UTC'};const first=new Intl.DateTimeFormat(localeFor(language),options).format(new Date(`${days[0].date}T00:00:00Z`));const last=new Intl.DateTimeFormat(localeFor(language),options).format(new Date(`${days[days.length-1].date}T00:00:00Z`));return `${first} — ${last}`}
function fmtDayParts(value,language){const date=new Date(`${value}T00:00:00Z`);return {weekday:new Intl.DateTimeFormat(localeFor(language),{weekday:'short',timeZone:'UTC'}).format(date).replace('.',''),date:new Intl.DateTimeFormat(localeFor(language),{day:'numeric',month:'short',timeZone:'UTC'}).format(date).replace('.','')}}
function timeToMinutes(value){if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);if(h>23||m>59)return null;return h*60+m}
function calculateHours(start,end){const startMinutes=timeToMinutes(start);let endMinutes=timeToMinutes(end);if(startMinutes==null||endMinutes==null)return 0;if(endMinutes<=startMinutes)endMinutes+=1440;return Math.round(((endMinutes-startMinutes)/60)*100)/100}
function formatHours(value,language){const minutes=Math.round((Number(value)||0)*60);const hours=Math.floor(minutes/60);const mins=minutes%60;if(language==='uk')return `${hours} год ${String(mins).padStart(2,'0')} хв`;if(language==='cs')return `${hours} h ${String(mins).padStart(2,'0')} min`;return `${hours}h ${String(mins).padStart(2,'0')}m`}
function formatHoursShort(value,language){const minutes=Math.round((Number(value)||0)*60);const hours=Math.floor(minutes/60);const mins=minutes%60;if(language==='uk')return mins?`${hours} год ${mins} хв`:`${hours} год`;if(language==='cs')return mins?`${hours} h ${mins} min`:`${hours} h`;return mins?`${hours}h ${mins}m`:`${hours}h`}
function formatBreak(minutes,language){const value=Number(minutes||0);if(language==='uk')return value===60?'1 год':`${value} хв`;if(language==='cs')return value===60?'1 h':`${value} min`;return value===60?'1h':`${value}m`}
function dayEntries(entries,date){return entries.filter(entry=>entry.workDate===date).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')))}
function getDayTotal(entries,date){return dayEntries(entries,date).reduce((sum,entry)=>sum+(Number(entry.hours)||0),0)}

export function FastHoursPage(){
  const {language}=useI18n();
  const c=COPY[language]||COPY.uk;
  const current=useMemo(weekStartNow,[]);
  const [weekStart,setWeekStart]=useState(()=>initialWeek(current));
  const {data,error,isFetching}=useGetWeekEntriesQuery({weekStart});
  const {data:rulesData}=useGetWorkRulesQuery();
  const projectsQuery=useGetProjectsQuery();
  const {data:defaultProjectData}=useGetDefaultProjectQuery();
  const projects=(projectsQuery.data?.projects||[]).filter(project=>project.isActive);
  const [updateDefaultProject,defaultProjectState]=useUpdateDefaultProjectMutation();
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
  const [projectPickerOpen,setProjectPickerOpen]=useState(false);
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
  const busy=isFetching||defaultProjectState.isLoading||createState.isLoading||updateState.isLoading||deleteState.isLoading||submitState.isLoading;
  const breakMinutes=Number(rulesData?.workRules?.breakMinutes||0);
  const standardDailyHours=Number(rulesData?.workRules?.standardDailyHours||8);
  const weeklyNorm=standardDailyHours*5;
  const weekTotal=entries.reduce((sum,entry)=>sum+(Number(entry.hours)||0),0);
  const overtime=days.reduce((sum,day)=>sum+Math.max(0,getDayTotal(entries,day.date)-standardDailyHours),0);
  const progress=Math.max(0,Math.min(100,weeklyNorm?weekTotal/weeklyNorm*100:0));
  const calculatedGross=calculateHours(startTime,endTime);
  const calculatedBreak=calculatedGross>breakMinutes/60?breakMinutes:0;
  const calculatedNet=Math.max(0,calculatedGross-calculatedBreak/60);
  const quickGross=calculateHours(quickStart,quickEnd);
  const quickBreak=quickGross>breakMinutes/60?breakMinutes:0;
  const quickNet=Math.max(0,quickGross-quickBreak/60);
  const configuredDefaultId=defaultProjectData?.projectId||'';
  const primaryProject=projects.find(project=>project.id===configuredDefaultId)||projects[0];
  const selectedProject=projectId||primaryProject?.id||'';
  const selectedQuickProject=quickProject||primaryProject?.id||'';

  function resetMessages(){setMessage('');setActionError('')}
  function openNew(date){resetMessages();setEditingId('');setEditingDate(date);setProjectId(primaryProject?.id||'');setStartTime('07:00');setEndTime('15:30');setNote('');setEditorOpen(true)}
  function openExisting(entry){resetMessages();setEditingId(entry.id);setEditingDate(entry.workDate);setProjectId(entry.projectId||entry.project?.id||'');setStartTime(entry.startTime||'07:00');setEndTime(entry.endTime||'15:30');setNote(entry.note||'');setEditorOpen(true)}
  function changeWeek(amount){setEditorOpen(false);setQuickOpen(false);setProjectPickerOpen(false);setWeekStart(shiftWeek(weekStart,amount))}

  async function chooseDefaultProject(nextProjectId){
    resetMessages();
    try{
      await updateDefaultProject(nextProjectId).unwrap();
      setProjectId('');
      setQuickProject('');
      setProjectPickerOpen(false);
      setMessage(c.defaultSaved);
    }catch(err){setActionError(getApiErrorMessage(err))}
  }

  async function saveShift(event){
    event.preventDefault();
    if(locked||!selectedProject||calculatedGross<=0){setActionError(c.invalidTime);return}
    resetMessages();
    const payload={projectId:selectedProject,startTime,endTime,note};
    try{
      if(editingId)await updateEntry({entryId:editingId,...payload}).unwrap();
      else{
        const sameProject=entries.find(entry=>entry.workDate===editingDate&&entry.projectId===selectedProject);
        if(sameProject)await updateEntry({entryId:sameProject.id,...payload}).unwrap();
        else await createEntry({workDate:editingDate,...payload}).unwrap();
      }
      setEditorOpen(false);setMessage(c.saved);
    }catch(err){setActionError(getApiErrorMessage(err))}
  }

  async function removeShift(){if(!editingId||locked)return;resetMessages();try{await deleteEntry(editingId).unwrap();setEditorOpen(false);setMessage(c.saved)}catch(err){setActionError(getApiErrorMessage(err))}}
  function toggleDay(index){setSelectedDays(currentDays=>currentDays.includes(index)?currentDays.filter(day=>day!==index):[...currentDays,index].sort())}

  async function applyQuickFill(){
    resetMessages();
    if(!selectedDays.length){setActionError(c.selectDays);return}
    if(!selectedQuickProject||quickGross<=0){setActionError(c.invalidTime);return}
    try{
      for(const index of selectedDays){
        const day=days[index];if(!day)continue;
        const payload={projectId:selectedQuickProject,startTime:quickStart,endTime:quickEnd,note:''};
        const existing=entries.find(entry=>entry.workDate===day.date&&entry.projectId===selectedQuickProject);
        if(existing)await updateEntry({entryId:existing.id,...payload}).unwrap();
        else await createEntry({workDate:day.date,...payload}).unwrap();
      }
      setQuickOpen(false);setMessage(c.quickSaved);
    }catch(err){setActionError(getApiErrorMessage(err))}
  }

  async function send(){resetMessages();try{await submitWeek({weekStart}).unwrap()}catch(err){setActionError(getApiErrorMessage(err))}}

  return <section className="fastHoursPage pageStack">
    <section className="fastHero screenCard">
      <div className="fastHeroTop"><div><h1>{c.myHours}</h1><p>{fmtWeekRange(days,language)}</p></div><span className={`fastHoursStatus is-${status.toLowerCase()}`}><i/> {c.status[status]||status}</span></div>
      <strong className="fastHeroTotal">{formatHoursShort(weekTotal,language)}</strong>
      <p className="fastHeroNorm">{Number(weekTotal).toFixed(1)} / {weeklyNorm.toFixed(0)} {c.weeklyNorm}</p>
      <div className="fastHeroProgress"><span style={{width:`${progress}%`}}/></div>
    </section>

    <section className="fastWeekBar"><button type="button" disabled={busy} aria-label={c.previous} onClick={()=>changeWeek(-1)}>‹</button><div><strong>{fmtWeekRange(days,language)||c.thisWeek}</strong><span>{weekStart===current?c.thisWeek:''}</span></div><button type="button" disabled={busy||weekStart>=current} aria-label={c.next} onClick={()=>changeWeek(1)}>›</button></section>

    {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}{locked?<p className="statusNote">{c.locked}</p>:null}

    <section className="fastProjectCard screenCard"><span className="fastProjectIcon">▦</span><div><strong>{primaryProject?.name||c.project}</strong><small>{c.autoSaved}</small></div><button type="button" disabled={busy||!projects.length} aria-label={c.choosePrimary} onClick={()=>setProjectPickerOpen(value=>!value)}>•••</button></section>

    {projectPickerOpen?<section className="fastProjectPicker screenCard"><header><strong>{c.choosePrimary}</strong><button type="button" onClick={()=>setProjectPickerOpen(false)} aria-label={c.close}>×</button></header><div>{projects.map(project=><button type="button" className={project.id===primaryProject?.id?'is-active':''} disabled={defaultProjectState.isLoading} onClick={()=>chooseDefaultProject(project.id)} key={project.id}><span><strong>{project.name}</strong>{project.address?<small>{project.address}</small>:null}</span>{project.id===primaryProject?.id?<b>✓ {c.primary}</b>:<i>›</i>}</button>)}</div></section>:null}

    <section className="fastDaysCard screenCard">
      {days.map(day=>{const items=dayEntries(entries,day.date);const dayTotal=getDayTotal(entries,day.date);const parts=fmtDayParts(day.date,language);const first=items[0];const dayOvertime=Math.max(0,dayTotal-standardDailyHours);return <article className="fastDayRow" key={day.date}>
        <div className="fastDayDate"><strong>{parts.weekday}</strong><span>{parts.date}</span></div>
        <div className="fastDayShift">{items.length?<button type="button" className="fastDayMain" onClick={()=>openExisting(first)}><strong>{first.startTime&&first.endTime?`${first.startTime} – ${first.endTime}`:first.project?.name}</strong><small>{Number(first.breakMinutes)>0?`${c.break} ${formatBreak(first.breakMinutes,language)}`:first.project?.name}</small></button>:<div className="fastDayEmpty"><strong>—</strong><small>{c.noShift}</small></div>}</div>
        <div className="fastDayAction">{items.length?<><button className="fastDayHours" type="button" onClick={()=>openExisting(first)}>{formatHoursShort(dayTotal,language)}</button>{dayOvertime>0?<small className="fastDayOvertime">● +{formatHoursShort(dayOvertime,language)} {c.overtime.toLowerCase()}</small>:null}<span className="fastDayChevron">›</span></>:<button className="fastDayPlus" type="button" disabled={locked||busy} onClick={()=>openNew(day.date)}>＋</button>}</div>
      </article>})}
    </section>

    <section className={`fastQuickCard screenCard${quickOpen?' is-open':''}`}>
      <button className="fastQuickTrigger" type="button" disabled={locked||busy||!projects.length} onClick={()=>setQuickOpen(value=>!value)}><span className="fastQuickBolt">ϟ</span><span><strong>{c.quickTitle}</strong><small>{c.quickCopy}</small></span><b>›</b></button>
      {quickOpen?<div className="fastQuickFill">
        <label><span>{c.project}</span><select value={selectedQuickProject} onChange={e=>setQuickProject(e.target.value)}>{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        <div className="fastQuickTimes"><label><span>{c.from}</span><input type="time" value={quickStart} onChange={e=>setQuickStart(e.target.value)}/></label><label><span>{c.to}</span><input type="time" value={quickEnd} onChange={e=>setQuickEnd(e.target.value)}/></label></div>
        <div className="fastQuickDays">{days.map((day,index)=><button type="button" className={selectedDays.includes(index)?'is-active':''} onClick={()=>toggleDay(index)} key={day.date}>{new Intl.DateTimeFormat(localeFor(language),{weekday:'short',timeZone:'UTC'}).format(new Date(`${day.date}T00:00:00Z`)).replace('.','')}</button>)}</div>
        <div className="fastQuickSummary"><span>{c.gross} {formatHours(quickGross,language)} · −{formatBreak(quickBreak,language)} {c.break}</span><strong>{c.net}: {formatHours(quickNet,language)}</strong></div>
        <button className="fastQuickApply" type="button" disabled={busy||locked} onClick={applyQuickFill}>{c.apply}</button>
      </div>:null}
    </section>

    <section className="fastBottomSummary"><div><span>{c.weekTotal}</span><strong>{formatHoursShort(weekTotal,language)}</strong></div><div><span>{c.overtime}</span><strong className={overtime>0?'is-overtime':''}>{formatHoursShort(overtime,language)}</strong></div></section>
    {message?<p className="statusNote is-success">{message}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}
    <button className="fastSend" type="button" disabled={locked||busy||!entries.length} onClick={send}>{c.submit} →</button>

    {editorOpen?<div className="fastEditorBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setEditorOpen(false)}}><section className="fastEditorSheet">
      <header><div><span>{fmtLong(editingDate,language)}</span><h2>{editingId?c.editShift:c.addShift}</h2></div><button type="button" aria-label={c.close} onClick={()=>setEditorOpen(false)}>×</button></header>
      <form className="fastEditorBody" onSubmit={saveShift}>
        <label><span>{c.project}</span><select value={selectedProject} disabled={busy||locked} onChange={e=>setProjectId(e.target.value)}>{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
        <div className="fastEditorTimes"><label><span>{c.from}</span><input type="time" value={startTime} disabled={busy||locked} onChange={e=>setStartTime(e.target.value)}/></label><label><span>{c.to}</span><input type="time" value={endTime} disabled={busy||locked} onChange={e=>setEndTime(e.target.value)}/></label></div>
        <div className="fastEditorTotal"><div><span>{c.gross}</span><strong>{formatHours(calculatedGross,language)}</strong></div>{calculatedBreak>0?<div><span>{c.break}</span><strong>−{formatBreak(calculatedBreak,language)}</strong></div>:null}<div><span>{c.net}</span><strong>{formatHours(calculatedNet,language)}</strong></div></div>
        <label><span>{c.note}</span><textarea value={note} disabled={busy||locked} placeholder={c.notePlaceholder} onChange={e=>setNote(e.target.value)}/></label>
        <button className="fastEditorSave" type="submit" disabled={busy||locked||calculatedGross<=0}>{c.saveShift}</button>
        {editingId?<button className="fastEditorDelete" type="button" disabled={busy||locked} onClick={removeShift}>{c.deleteShift}</button>:null}
      </form>
    </section></div>:null}
  </section>;
}
