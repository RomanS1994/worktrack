import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { formatCzk, getLocalDateKey, resolveLocale } from '../../app/formatters.js';
import { useDeleteManagerExpenseMutation, useGetManagerExpensesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerExpensesPage.css';

const CATEGORIES={
 MATERIALS:{uk:'Матеріали',cs:'Materiál',en:'Materials'},TRANSPORT:{uk:'Транспорт',cs:'Doprava',en:'Transport'},FUEL:{uk:'Паливо',cs:'Palivo',en:'Fuel'},TOOLS:{uk:'Інструменти',cs:'Nářadí',en:'Tools'},OFFICE:{uk:'Офіс',cs:'Kancelář',en:'Office'},OTHER:{uk:'Інше',cs:'Ostatní',en:'Other'}
};
const COPY={
 uk:{title:'Витрати',subtitle:'Витрати компанії за вибраний період',month:'Місяць',category:'Категорія',all:'Усі категорії',total:'Витрачено за місяць',count:'Кількість витрат',history:'Історія витрат',empty:'За цей місяць витрат немає',add:'Додати витрату',delete:'Видалити',confirm:'Видалити цю витрату?',employee:'Працівник'},
 cs:{title:'Výdaje',subtitle:'Firemní výdaje za zvolené období',month:'Měsíc',category:'Kategorie',all:'Všechny kategorie',total:'Výdaje za měsíc',count:'Počet výdajů',history:'Historie výdajů',empty:'V tomto měsíci nejsou žádné výdaje',add:'Přidat výdaj',delete:'Smazat',confirm:'Smazat tento výdaj?',employee:'Zaměstnanec'},
 en:{title:'Expenses',subtitle:'Company expenses for the selected period',month:'Month',category:'Category',all:'All categories',total:'Spent this month',count:'Number of expenses',history:'Expense history',empty:'No expenses this month',add:'Add expense',delete:'Delete',confirm:'Delete this expense?',employee:'Employee'}
};
function monthKey(){return getLocalDateKey().slice(0,7)}
export function ManagerExpensesPage(){
 const navigate=useNavigate(); const {language}=useI18n(); const copy=COPY[language]||COPY.uk; const locale=resolveLocale(language);
 const [month,setMonth]=useState(monthKey()); const [category,setCategory]=useState('');
 const query=useGetManagerExpensesQuery({month,category:category||undefined}); const [deleteExpense,deleteState]=useDeleteManagerExpenseMutation();
 const expenses=query.data?.expenses||[]; const total=Number(query.data?.summary?.totalCzk||0); const error=query.error||deleteState.error;
 const groups=useMemo(()=>{const map=new Map();expenses.forEach(item=>{if(!map.has(item.spentAt))map.set(item.spentAt,[]);map.get(item.spentAt).push(item)});return [...map.entries()]},[expenses]);
 async function remove(id){if(!window.confirm(copy.confirm))return;await deleteExpense(id).unwrap()}
 return <section className="managerExpensesPage pageStack">
  <header className="managerExpenses-header"><div><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><button type="button" onClick={()=>navigate('/manager/expenses/new')} aria-label={copy.add}>＋<span>{copy.add}</span></button></header>
  <section className="managerExpenses-summary"><div><span>{copy.total}</span><strong>{formatCzk(total,locale)}</strong></div><div><span>{copy.count}</span><strong>{expenses.length}</strong></div></section>
  <section className="managerExpenses-filters"><label><span>{copy.month}</span><input type="month" value={month} onChange={e=>setMonth(e.target.value||monthKey())}/></label><label><span>{copy.category}</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{copy.all}</option>{Object.keys(CATEGORIES).map(key=><option key={key} value={key}>{CATEGORIES[key][language]||CATEGORIES[key].uk}</option>)}</select></label></section>
  {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}{query.isLoading?<RequestLoadingState label={copy.history}/>:null}
  {!query.isLoading?<section className="managerExpenses-history"><div className="managerExpenses-title"><h2>{copy.history}</h2><span>{expenses.length}</span></div>{groups.length?groups.map(([date,items])=><div className="managerExpenses-day" key={date}><div className="managerExpenses-date">{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}</div>{items.map(item=><article className="managerExpenses-row" key={item.id}><div className="managerExpenses-icon">₭</div><div className="managerExpenses-text"><strong>{CATEGORIES[item.category]?.[language]||CATEGORIES[item.category]?.uk||item.category}</strong><span>{item.employee?.name?`${copy.employee}: ${item.employee.name}`:(item.note||'—')}</span>{item.employee?.name&&item.note?<span>{item.note}</span>:null}</div><div className="managerExpenses-amount"><strong>− {formatCzk(item.amountCzk,locale)}</strong><button type="button" disabled={deleteState.isLoading} onClick={()=>remove(item.id)}>{copy.delete}</button></div></article>)}</div>):<div className="managerExpenses-empty">{copy.empty}</div>}</section>:null}
 </section>
}
