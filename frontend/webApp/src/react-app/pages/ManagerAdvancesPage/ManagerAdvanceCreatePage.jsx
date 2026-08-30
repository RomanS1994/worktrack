import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getLocalDateKey } from '../../app/formatters.js';
import { useCreateManagerAdvanceMutation, useGetManagerAdvancesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerAdvanceCreatePage.css';

const COPY={
 uk:{title:'Новий аванс',subtitle:'Додайте виплату працівнику',back:'Назад',employee:'Працівник',chooseEmployee:'Оберіть працівника',amount:'Сума авансу',amountHint:'Вкажіть суму виплати працівнику',date:'Дата виплати',note:'Примітка',optional:'необов’язково',notePlaceholder:'Наприклад: видано на карту',save:'Зберегти аванс',saving:'Збереження…',hint:'Аванс буде віднято від чистої зарплати працівника.'},
 cs:{title:'Nová záloha',subtitle:'Přidejte platbu zaměstnanci',back:'Zpět',employee:'Zaměstnanec',chooseEmployee:'Vyberte zaměstnance',amount:'Částka zálohy',amountHint:'Zadejte částku platby zaměstnanci',date:'Datum výplaty',note:'Poznámka',optional:'nepovinné',notePlaceholder:'Např. vyplaceno na kartu',save:'Uložit zálohu',saving:'Ukládání…',hint:'Záloha bude odečtena od čisté mzdy zaměstnance.'},
 en:{title:'New advance',subtitle:'Add a payment for an employee',back:'Back',employee:'Employee',chooseEmployee:'Choose employee',amount:'Advance amount',amountHint:'Enter the amount paid to the employee',date:'Payment date',note:'Note',optional:'optional',notePlaceholder:'For example: paid to card',save:'Save advance',saving:'Saving…',hint:'The advance will be deducted from the employee’s net salary.'}
};
function PersonIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20v-2.2A5.8 5.8 0 0 1 11.3 12h1.4a5.8 5.8 0 0 1 5.8 5.8V20"/></svg>}
function CalendarIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z"/></svg>}
export function ManagerAdvanceCreatePage(){
 const navigate=useNavigate(); const {language}=useI18n(); const copy=COPY[language]||COPY.uk;
 const month=getLocalDateKey().slice(0,7); const query=useGetManagerAdvancesQuery({month}); const employees=query.data?.employees||[];
 const [employeeMembershipId,setEmployeeMembershipId]=useState(''); const [amountCzk,setAmountCzk]=useState(''); const [paidAt,setPaidAt]=useState(getLocalDateKey()); const [note,setNote]=useState('');
 const [createAdvance,state]=useCreateManagerAdvanceMutation();
 const amount=Number(String(amountCzk).replace(',','.')); const canSubmit=employeeMembershipId&&amount>0&&paidAt&&!state.isLoading;
 async function submit(e){e.preventDefault();if(!canSubmit)return;await createAdvance({employeeMembershipId,amountCzk:String(amountCzk).replace(',','.'),paidAt,note}).unwrap();navigate('/manager/advances',{replace:true})}
 return <section className="advanceCreatePage pageStack">
  <header className="advanceCreate-header"><button type="button" onClick={()=>navigate(-1)} aria-label={copy.back}>‹</button><div><h1>{copy.title}</h1><p>{copy.subtitle}</p></div></header>
  <form className="advanceCreate-card" onSubmit={submit}>
   <label className="advanceCreate-field"><span>{copy.employee}</span><div className="advanceCreate-selectShell"><i><PersonIcon/></i><select value={employeeMembershipId} onChange={e=>setEmployeeMembershipId(e.target.value)} required><option value="">{copy.chooseEmployee}</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div></label>
   <label className="advanceCreate-field"><span>{copy.amount}</span><div className="advanceCreate-money"><input inputMode="decimal" value={amountCzk} onChange={e=>setAmountCzk(e.target.value)} placeholder="0" required/><b>Kč</b></div><small>{copy.amountHint}</small></label>
   <label className="advanceCreate-field"><span>{copy.date}</span><div className="advanceCreate-dateShell"><i><CalendarIcon/></i><input type="date" value={paidAt} onChange={e=>setPaidAt(e.target.value)} required/></div></label>
   <label className="advanceCreate-field"><span>{copy.note} <em>({copy.optional})</em></span><input value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder={copy.notePlaceholder}/></label>
   <div className="advanceCreate-inlineHint"><i>i</i><span>{copy.hint}</span></div>
   {state.error?<p className="statusNote is-error">{getApiErrorMessage(state.error)}</p>:null}
   <button className="advanceCreate-save" type="submit" disabled={!canSubmit}>{state.isLoading?copy.saving:copy.save}</button>
  </form>
 </section>
}
