import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getLocalDateKey } from '../../app/formatters.js';
import { useCreateManagerAdvanceMutation, useGetManagerAdvancesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerAdvanceCreatePage.css';

const COPY={
 uk:{title:'Новий залог',subtitle:'Вкажіть працівника, суму та дату виплати.',back:'Назад',employee:'Працівник',chooseEmployee:'Оберіть працівника',amount:'Сума',date:'Дата',note:'Примітка',notePlaceholder:'Наприклад: видано на карту',save:'Зберегти залог',saving:'Збереження…',hintTitle:'Як це працює',hint:'Після збереження залог автоматично буде віднятий від чистої зарплати працівника.'},
 cs:{title:'Nová záloha',subtitle:'Vyberte zaměstnance, částku a datum výplaty.',back:'Zpět',employee:'Zaměstnanec',chooseEmployee:'Vyberte zaměstnance',amount:'Částka',date:'Datum',note:'Poznámka',notePlaceholder:'Např. vyplaceno na kartu',save:'Uložit zálohu',saving:'Ukládání…',hintTitle:'Jak to funguje',hint:'Po uložení bude záloha automaticky odečtena od čisté mzdy zaměstnance.'},
 en:{title:'New advance',subtitle:'Choose the employee, amount and payment date.',back:'Back',employee:'Employee',chooseEmployee:'Choose employee',amount:'Amount',date:'Date',note:'Note',notePlaceholder:'For example: paid to card',save:'Save advance',saving:'Saving…',hintTitle:'How it works',hint:'After saving, the advance will automatically be deducted from the employee’s net salary.'}
};

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
   <label><span>{copy.employee}</span><select value={employeeMembershipId} onChange={e=>setEmployeeMembershipId(e.target.value)} required><option value="">{copy.chooseEmployee}</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
   <div className="advanceCreate-grid"><label><span>{copy.amount}</span><div className="advanceCreate-money"><input inputMode="decimal" value={amountCzk} onChange={e=>setAmountCzk(e.target.value)} placeholder="0" required/><b>Kč</b></div></label><label><span>{copy.date}</span><input type="date" value={paidAt} onChange={e=>setPaidAt(e.target.value)} required/></label></div>
   <label><span>{copy.note}</span><input value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder={copy.notePlaceholder}/></label>
   <div className="advanceCreate-hint"><i>i</i><div><strong>{copy.hintTitle}</strong><span>{copy.hint}</span></div></div>
   {state.error?<p className="statusNote is-error">{getApiErrorMessage(state.error)}</p>:null}
   <button className="advanceCreate-save" type="submit" disabled={!canSubmit}>{state.isLoading?copy.saving:copy.save}</button>
  </form>
 </section>
}
