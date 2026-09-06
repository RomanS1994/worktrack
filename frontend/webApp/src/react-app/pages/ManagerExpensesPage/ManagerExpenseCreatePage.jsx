import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getLocalDateKey } from '../../app/formatters.js';
import { prepareExpenseReceipt } from '../../features/worktrack/expenseReceipt.js';
import { useCreateManagerExpenseMutation, useGetManagerEmployeesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerExpenseCreatePage.css';

const COPY={
 uk:{title:'Нова витрата',subtitle:'Додайте витрату компанії',employee:'Працівник',chooseEmployee:'Оберіть працівника',category:'Категорія',amount:'Сума',date:'Дата',note:'Примітка',optional:'необов’язково',save:'Зберегти витрату',saving:'Збереження…',notePlaceholder:'Наприклад: купівля матеріалів',receipt:'Квитанція / чек',receiptHint:'Зробіть фото або виберіть з галереї',addReceipt:'Додати фото',replaceReceipt:'Замінити фото',removeReceipt:'Видалити',preparingReceipt:'Підготовка фото…',receiptInvalid:'Оберіть фото у форматі JPG, PNG або WebP.',receiptTooLarge:'Фото завелике. Спробуйте інше або зробіть фото чеку ще раз.'},
 cs:{title:'Nový výdaj',subtitle:'Přidejte firemní výdaj',employee:'Zaměstnanec',chooseEmployee:'Vyberte zaměstnance',category:'Kategorie',amount:'Částka',date:'Datum',note:'Poznámka',optional:'nepovinné',save:'Uložit výdaj',saving:'Ukládání…',notePlaceholder:'Např. nákup materiálu',receipt:'Účtenka / doklad',receiptHint:'Vyfoťte doklad nebo vyberte fotografii z galerie',addReceipt:'Přidat foto',replaceReceipt:'Změnit foto',removeReceipt:'Odstranit',preparingReceipt:'Příprava fotografie…',receiptInvalid:'Vyberte fotografii ve formátu JPG, PNG nebo WebP.',receiptTooLarge:'Fotografie je příliš velká. Zkuste jinou nebo doklad vyfoťte znovu.'},
 en:{title:'New expense',subtitle:'Add a company expense',employee:'Employee',chooseEmployee:'Choose employee',category:'Category',amount:'Amount',date:'Date',note:'Note',optional:'optional',save:'Save expense',saving:'Saving…',notePlaceholder:'For example: materials purchase',receipt:'Receipt / bill',receiptHint:'Take a photo or choose one from your library',addReceipt:'Add photo',replaceReceipt:'Replace photo',removeReceipt:'Remove',preparingReceipt:'Preparing photo…',receiptInvalid:'Choose a JPG, PNG or WebP image.',receiptTooLarge:'The image is too large. Try another image or take the receipt photo again.'}
};
const CATS={MATERIALS:{uk:'Матеріали',cs:'Materiál',en:'Materials'},TRANSPORT:{uk:'Транспорт',cs:'Doprava',en:'Transport'},FUEL:{uk:'Паливо',cs:'Palivo',en:'Fuel'},TOOLS:{uk:'Інструменти',cs:'Nářadí',en:'Tools'},OFFICE:{uk:'Офіс',cs:'Kancelář',en:'Office'},OTHER:{uk:'Інше',cs:'Ostatní',en:'Other'}};

export function ManagerExpenseCreatePage(){
 const navigate=useNavigate();
 const {language}=useI18n();
 const c=COPY[language]||COPY.uk;
 const employeesQuery=useGetManagerEmployeesQuery();
 const employees=(employeesQuery.data?.employees||[]).filter(employee=>String(employee.status||'ACTIVE').toUpperCase()==='ACTIVE');
 const [employeeMembershipId,setEmployeeMembershipId]=useState('');
 const [category,setCategory]=useState('MATERIALS');
 const [amountCzk,setAmountCzk]=useState('');
 const [spentAt,setSpentAt]=useState(getLocalDateKey());
 const [note,setNote]=useState('');
 const [receipt,setReceipt]=useState(null);
 const [receiptError,setReceiptError]=useState('');
 const [receiptPreparing,setReceiptPreparing]=useState(false);
 const receiptInputRef=useRef(null);
 const [createExpense,state]=useCreateManagerExpenseMutation();
 const canSubmit=employeeMembershipId&&Number(String(amountCzk).replace(',','.'))>0&&spentAt&&!state.isLoading&&!receiptPreparing;
 async function chooseReceipt(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setReceiptError('');setReceiptPreparing(true);
  try{setReceipt(await prepareExpenseReceipt(file))}catch(error){setReceipt(null);setReceiptError(error?.message==='large'?c.receiptTooLarge:c.receiptInvalid)}finally{setReceiptPreparing(false)}
 }
 async function submit(e){
  e.preventDefault();
  if(!canSubmit)return;
  await createExpense({employeeMembershipId,category,amountCzk:String(amountCzk).replace(',','.'),spentAt,note,receipt}).unwrap();
  navigate('/manager/expenses',{replace:true});
 }
 return <section className="expenseCreatePage pageStack">
  <header className="expenseCreate-header"><button type="button" onClick={()=>navigate(-1)}>‹</button><div><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <form className="expenseCreate-card" onSubmit={submit}>
   <label><span>{c.employee}</span><select value={employeeMembershipId} onChange={e=>setEmployeeMembershipId(e.target.value)} required><option value="">{c.chooseEmployee}</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name||employee.email}</option>)}</select></label>
   <label><span>{c.category}</span><select value={category} onChange={e=>setCategory(e.target.value)}>{Object.keys(CATS).map(key=><option key={key} value={key}>{CATS[key][language]||CATS[key].uk}</option>)}</select></label>
   <label><span>{c.amount}</span><div className="expenseCreate-money"><input inputMode="decimal" value={amountCzk} onChange={e=>setAmountCzk(e.target.value)} placeholder="0" required/><b>Kč</b></div></label>
   <label><span>{c.date}</span><input type="date" value={spentAt} onChange={e=>setSpentAt(e.target.value)} required/></label>
   <label><span>{c.note} <em>({c.optional})</em></span><input value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder={c.notePlaceholder}/></label>
   <div className="expenseCreate-receipt">
    <div className="expenseCreate-receiptHeading"><span>{c.receipt} <em>({c.optional})</em></span><small>{c.receiptHint}</small></div>
    <input ref={receiptInputRef} className="expenseCreate-fileInput" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReceipt}/>
    {receipt?<div className="expenseCreate-receiptPreview"><img src={receipt.dataUrl} alt={c.receipt}/><div><strong>{receipt.fileName}</strong><div className="expenseCreate-receiptActions"><button type="button" onClick={()=>receiptInputRef.current?.click()}>{c.replaceReceipt}</button><button type="button" className="is-danger" onClick={()=>{setReceipt(null);setReceiptError('')}}>{c.removeReceipt}</button></div></div></div>:<button type="button" className="expenseCreate-addReceipt" disabled={receiptPreparing} onClick={()=>receiptInputRef.current?.click()}><span>＋</span>{receiptPreparing?c.preparingReceipt:c.addReceipt}</button>}
    {receiptError?<p className="expenseCreate-receiptError">{receiptError}</p>:null}
   </div>
   {(state.error||employeesQuery.error)?<p className="statusNote is-error">{getApiErrorMessage(state.error||employeesQuery.error)}</p>:null}
   <button className="expenseCreate-save" type="submit" disabled={!canSubmit}>{state.isLoading?c.saving:c.save}</button>
  </form>
 </section>
}
