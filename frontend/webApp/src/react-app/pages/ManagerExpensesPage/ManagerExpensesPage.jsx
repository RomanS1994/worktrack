import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { formatCzk, getLocalDateKey, resolveLocale } from '../../app/formatters.js';
import { openExpenseReceipt, prepareExpenseReceipt, uploadExpenseReceipt } from '../../features/worktrack/expenseReceipt.js';
import { useDeleteManagerExpenseMutation, useGetManagerExpensesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerExpensesPage.css';

const CATEGORIES={
 MATERIALS:{uk:'Матеріали',cs:'Materiál',en:'Materials'},TRANSPORT:{uk:'Транспорт',cs:'Doprava',en:'Transport'},FUEL:{uk:'Паливо',cs:'Palivo',en:'Fuel'},TOOLS:{uk:'Інструменти',cs:'Nářadí',en:'Tools'},OFFICE:{uk:'Офіс',cs:'Kancelář',en:'Office'},OTHER:{uk:'Інше',cs:'Ostatní',en:'Other'}
};
const COPY={
 uk:{title:'Витрати',subtitle:'Витрати компанії за вибраний період',featureBadge:'Фото чеків доступні',month:'Місяць',category:'Категорія',all:'Усі категорії',total:'Витрачено за місяць',count:'Кількість витрат',history:'Історія витрат',empty:'За цей місяць витрат немає',add:'Додати витрату',delete:'Видалити',confirm:'Видалити цю витрату?',employee:'Працівник',receipt:'Чек',openingReceipt:'Відкриття…',receiptError:'Не вдалося відкрити фото чеку.',details:'Деталі витрати',date:'Дата',note:'Примітка',noNote:'Без примітки',viewReceipt:'Переглянути фото',addReceipt:'Додати фото чеку',replaceReceipt:'Замінити фото',preparingReceipt:'Підготовка фото…',savingReceipt:'Збереження…',receiptInvalid:'Оберіть фото у форматі JPG, PNG або WebP.',receiptTooLarge:'Фото завелике. Спробуйте інше фото.',receiptSaveError:'Не вдалося зберегти фото чеку.',close:'Закрити'},
 cs:{title:'Výdaje',subtitle:'Firemní výdaje za zvolené období',featureBadge:'Fotky dokladů jsou dostupné',month:'Měsíc',category:'Kategorie',all:'Všechny kategorie',total:'Výdaje za měsíc',count:'Počet výdajů',history:'Historie výdajů',empty:'V tomto měsíci nejsou žádné výdaje',add:'Přidat výdaj',delete:'Smazat',confirm:'Smazat tento výdaj?',employee:'Zaměstnanec',receipt:'Doklad',openingReceipt:'Otevírání…',receiptError:'Fotografii dokladu se nepodařilo otevřít.',details:'Detail výdaje',date:'Datum',note:'Poznámka',noNote:'Bez poznámky',viewReceipt:'Zobrazit fotografii',addReceipt:'Přidat fotografii dokladu',replaceReceipt:'Změnit fotografii',preparingReceipt:'Příprava fotografie…',savingReceipt:'Ukládání…',receiptInvalid:'Vyberte JPG, PNG nebo WebP.',receiptTooLarge:'Fotografie je příliš velká.',receiptSaveError:'Fotografii dokladu se nepodařilo uložit.',close:'Zavřít'},
 en:{title:'Expenses',subtitle:'Company expenses for the selected period',featureBadge:'Receipt photos are available',month:'Month',category:'Category',all:'All categories',total:'Spent this month',count:'Number of expenses',history:'Expense history',empty:'No expenses this month',add:'Add expense',delete:'Delete',confirm:'Delete this expense?',employee:'Employee',receipt:'Receipt',openingReceipt:'Opening…',receiptError:'Could not open the receipt photo.',details:'Expense details',date:'Date',note:'Note',noNote:'No note',viewReceipt:'View photo',addReceipt:'Add receipt photo',replaceReceipt:'Replace photo',preparingReceipt:'Preparing photo…',savingReceipt:'Saving…',receiptInvalid:'Choose a JPG, PNG or WebP image.',receiptTooLarge:'The image is too large.',receiptSaveError:'Could not save the receipt photo.',close:'Close'}
};
function monthKey(){return getLocalDateKey().slice(0,7)}
export function ManagerExpensesPage(){
 const navigate=useNavigate(); const {language}=useI18n(); const copy=COPY[language]||COPY.uk; const locale=resolveLocale(language);
 const [month,setMonth]=useState(monthKey()); const [category,setCategory]=useState('');
 const [receiptLoadingId,setReceiptLoadingId]=useState(''); const [receiptError,setReceiptError]=useState('');
 const [selectedExpense,setSelectedExpense]=useState(null); const [receiptPreparing,setReceiptPreparing]=useState(false); const [receiptSaving,setReceiptSaving]=useState(false);
 const receiptInputRef=useRef(null);
 const query=useGetManagerExpensesQuery({month,category:category||undefined}); const [deleteExpense,deleteState]=useDeleteManagerExpenseMutation();
 const expenses=query.data?.expenses||[]; const total=Number(query.data?.summary?.totalCzk||0); const error=query.error||deleteState.error;
 const groups=useMemo(()=>{const map=new Map();expenses.forEach(item=>{if(!map.has(item.spentAt))map.set(item.spentAt,[]);map.get(item.spentAt).push(item)});return [...map.entries()]},[expenses]);
 async function remove(id){if(!window.confirm(copy.confirm))return;await deleteExpense(id).unwrap();if(selectedExpense?.id===id)setSelectedExpense(null)}
 async function viewReceipt(id){setReceiptError('');setReceiptLoadingId(id);try{await openExpenseReceipt(id)}catch{setReceiptError(copy.receiptError)}finally{setReceiptLoadingId('')}}
 async function chooseReceipt(e){
  const file=e.target.files?.[0];e.target.value='';if(!file||!selectedExpense)return;
  setReceiptError('');setReceiptPreparing(true);
  try{
   const receipt=await prepareExpenseReceipt(file);setReceiptPreparing(false);setReceiptSaving(true);
   const result=await uploadExpenseReceipt(selectedExpense.id,receipt);
   if(result?.expense)setSelectedExpense(result.expense);
   await query.refetch();
  }catch(error){setReceiptError(error?.message==='large'?copy.receiptTooLarge:error?.message==='invalid'?copy.receiptInvalid:copy.receiptSaveError)}finally{setReceiptPreparing(false);setReceiptSaving(false)}
 }
 return <section className="managerExpensesPage pageStack">
  <header className="managerExpenses-header"><div><h1>{copy.title}</h1><p>{copy.subtitle}</p><span className="managerExpenses-featureBadge">📎 {copy.featureBadge}</span></div><button type="button" onClick={()=>navigate('/manager/expenses/new')} aria-label={copy.add}>＋<span>{copy.add}</span></button></header>
  <section className="managerExpenses-summary"><div><span>{copy.total}</span><strong>{formatCzk(total,locale)}</strong></div><div><span>{copy.count}</span><strong>{expenses.length}</strong></div></section>
  <section className="managerExpenses-filters"><label><span>{copy.month}</span><input type="month" value={month} onChange={e=>setMonth(e.target.value||monthKey())}/></label><label><span>{copy.category}</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{copy.all}</option>{Object.keys(CATEGORIES).map(key=><option key={key} value={key}>{CATEGORIES[key][language]||CATEGORIES[key].uk}</option>)}</select></label></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}{receiptError&&!selectedExpense?<p className="statusNote is-error">{receiptError}</p>:null}{query.isLoading?<RequestLoadingState label={copy.history}/>:null}
  {!query.isLoading?<section className="managerExpenses-history"><div className="managerExpenses-title"><h2>{copy.history}</h2><span>{expenses.length}</span></div>{groups.length?groups.map(([date,items])=><div className="managerExpenses-day" key={date}><div className="managerExpenses-date">{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}</div>{items.map(item=><article className="managerExpenses-row" key={item.id} role="button" tabIndex="0" onClick={()=>{setReceiptError('');setSelectedExpense(item)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setReceiptError('');setSelectedExpense(item)}}><div className="managerExpenses-icon">₭</div><div className="managerExpenses-text"><strong>{CATEGORIES[item.category]?.[language]||CATEGORIES[item.category]?.uk||item.category}</strong><span>{item.employee?.name?`${copy.employee}: ${item.employee.name}`:(item.note||'—')}</span>{item.employee?.name&&item.note?<span>{item.note}</span>:null}{item.hasReceipt?<span className="managerExpenses-receiptBadge">▣ {copy.receipt}</span>:null}</div><div className="managerExpenses-amount"><strong>− {formatCzk(item.amountCzk,locale)}</strong><button type="button" disabled={deleteState.isLoading} onClick={e=>{e.stopPropagation();remove(item.id)}}>{copy.delete}</button></div></article>)}</div>):<div className="managerExpenses-empty">{copy.empty}</div>}</section>:null}

  {selectedExpense?<div className="managerExpenses-modalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedExpense(null)}}><section className="managerExpenses-modal" role="dialog" aria-modal="true" aria-label={copy.details}>
   <div className="managerExpenses-modalHandle"/>
   <header><div><span>{copy.details}</span><h2>{CATEGORIES[selectedExpense.category]?.[language]||CATEGORIES[selectedExpense.category]?.uk||selectedExpense.category}</h2></div><button type="button" onClick={()=>setSelectedExpense(null)} aria-label={copy.close}>×</button></header>
   <div className="managerExpenses-modalAmount">− {formatCzk(selectedExpense.amountCzk,locale)}</div>
   <dl><div><dt>{copy.employee}</dt><dd>{selectedExpense.employee?.name||'—'}</dd></div><div><dt>{copy.date}</dt><dd>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${selectedExpense.spentAt}T00:00:00Z`))}</dd></div><div><dt>{copy.note}</dt><dd>{selectedExpense.note||copy.noNote}</dd></div></dl>
   <div className="managerExpenses-modalReceipt"><div><strong>{copy.receipt}</strong><span>{selectedExpense.hasReceipt?(selectedExpense.receiptFileName||copy.receipt):copy.addReceipt}</span></div><input ref={receiptInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReceipt}/>{selectedExpense.hasReceipt?<div className="managerExpenses-modalReceiptActions"><button type="button" onClick={()=>viewReceipt(selectedExpense.id)} disabled={receiptLoadingId===selectedExpense.id}>{receiptLoadingId===selectedExpense.id?copy.openingReceipt:copy.viewReceipt}</button><button type="button" onClick={()=>receiptInputRef.current?.click()} disabled={receiptPreparing||receiptSaving}>{receiptPreparing?copy.preparingReceipt:receiptSaving?copy.savingReceipt:copy.replaceReceipt}</button></div>:<button type="button" className="managerExpenses-modalAddReceipt" onClick={()=>receiptInputRef.current?.click()} disabled={receiptPreparing||receiptSaving}>{receiptPreparing?copy.preparingReceipt:receiptSaving?copy.savingReceipt:copy.addReceipt}</button>}{receiptError?<p>{receiptError}</p>:null}</div>
  </section></div>:null}
 </section>
}
