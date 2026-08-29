import { useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { formatCzk, getLocalDateKey, resolveLocale } from '../../app/formatters.js';
import { useCreateManagerAdvanceMutation, useDeleteManagerAdvanceMutation, useGetManagerAdvancesQuery } from '../../features/worktrack/worktrackApi.js';
import './ManagerAdvancesPage.css';

const COPY = {
  uk: { title:'Залоги',subtitle:'Виплати працівникам наперед',month:'Місяць',add:'Додати залог',employee:'Працівник',amount:'Сума',date:'Дата',note:'Примітка',notePlaceholder:'Наприклад: готівкою',save:'Зберегти',saving:'Збереження…',received:'Видано за місяць',payments:'виплат',history:'Історія залогів',empty:'За цей місяць залогів немає',delete:'Видалити',confirmDelete:'Видалити цей залог?',chooseEmployee:'Оберіть працівника' },
  cs: { title:'Zálohy',subtitle:'Zálohy vyplacené zaměstnancům',month:'Měsíc',add:'Přidat zálohu',employee:'Zaměstnanec',amount:'Částka',date:'Datum',note:'Poznámka',notePlaceholder:'Např. hotově',save:'Uložit',saving:'Ukládání…',received:'Vyplaceno za měsíc',payments:'plateb',history:'Historie záloh',empty:'V tomto měsíci nejsou žádné zálohy',delete:'Smazat',confirmDelete:'Smazat tuto zálohu?',chooseEmployee:'Vyberte zaměstnance' },
  en: { title:'Advances',subtitle:'Salary advances paid to employees',month:'Month',add:'Add advance',employee:'Employee',amount:'Amount',date:'Date',note:'Note',notePlaceholder:'For example: cash',save:'Save',saving:'Saving…',received:'Paid this month',payments:'payments',history:'Advance history',empty:'No advances for this month',delete:'Delete',confirmDelete:'Delete this advance?',chooseEmployee:'Choose employee' },
};

function monthKey(dateKey) { return String(dateKey || getLocalDateKey()).slice(0, 7); }

export function ManagerAdvancesPage({ embedded = false }) {
  const { language } = useI18n();
  const copy = COPY[language] || COPY.uk;
  const locale = resolveLocale(language);
  const [month, setMonth] = useState(monthKey(getLocalDateKey()));
  const [formOpen, setFormOpen] = useState(false);
  const [employeeMembershipId, setEmployeeMembershipId] = useState('');
  const [amountCzk, setAmountCzk] = useState('');
  const [paidAt, setPaidAt] = useState(getLocalDateKey());
  const [note, setNote] = useState('');
  const query = useGetManagerAdvancesQuery({ month });
  const [createAdvance, createState] = useCreateManagerAdvanceMutation();
  const [deleteAdvance, deleteState] = useDeleteManagerAdvanceMutation();
  const employees = query.data?.employees || [];
  const advances = query.data?.advances || [];
  const total = Number(query.data?.summary?.totalCzk || 0);
  const error = query.error || createState.error || deleteState.error;
  const canSubmit = employeeMembershipId && Number(String(amountCzk).replace(',', '.')) > 0 && paidAt && !createState.isLoading;

  const grouped = useMemo(() => {
    const map = new Map();
    advances.forEach(item => {
      const key = item.paidAt;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()];
  }, [advances]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    await createAdvance({ employeeMembershipId, amountCzk: String(amountCzk).replace(',', '.'), paidAt, note }).unwrap();
    setAmountCzk(''); setNote(''); setFormOpen(false);
  }

  async function handleDelete(id) {
    if (!window.confirm(copy.confirmDelete)) return;
    await deleteAdvance(id).unwrap();
  }

  return <section className={`managerAdvancesPage pageStack${embedded?' is-embedded':''}`}>
    <header className="managerAdvances-header"><div><h1>{copy.title}</h1>{!embedded?<p>{copy.subtitle}</p>:null}</div><button type="button" className="managerAdvances-addButton" onClick={()=>setFormOpen(value=>!value)}>＋ <span>{copy.add}</span></button></header>

    <section className="managerAdvances-monthCard"><label><span>{copy.month}</span><input type="month" value={month} onChange={event=>setMonth(event.target.value || monthKey(getLocalDateKey()))}/></label><div><span>{copy.received}</span><strong>{formatCzk(total, locale)}</strong><small>{advances.length} {copy.payments}</small></div></section>

    {formOpen?<form className="managerAdvances-form" onSubmit={handleSubmit}><h2>{copy.add}</h2><label><span>{copy.employee}</span><select value={employeeMembershipId} onChange={event=>setEmployeeMembershipId(event.target.value)} required><option value="">{copy.chooseEmployee}</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><div className="managerAdvances-formGrid"><label><span>{copy.amount}</span><div className="managerAdvances-moneyInput"><input inputMode="decimal" value={amountCzk} onChange={event=>setAmountCzk(event.target.value)} placeholder="0" required/><b>Kč</b></div></label><label><span>{copy.date}</span><input type="date" value={paidAt} onChange={event=>setPaidAt(event.target.value)} required/></label></div><label><span>{copy.note}</span><input value={note} maxLength={500} onChange={event=>setNote(event.target.value)} placeholder={copy.notePlaceholder}/></label><button className="managerAdvances-saveButton" type="submit" disabled={!canSubmit}>{createState.isLoading?copy.saving:copy.save}</button></form>:null}

    {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
    {query.isLoading?<RequestLoadingState label={copy.history}/>:null}
    {!query.isLoading?<section className="managerAdvances-history"><div className="managerAdvances-sectionTitle"><h2>{copy.history}</h2><span>{advances.length}</span></div>{grouped.length?grouped.map(([date, items])=><div className="managerAdvances-day" key={date}><div className="managerAdvances-date">{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))}</div>{items.map(item=><article className="managerAdvances-row" key={item.id}><div className="managerAdvances-avatar">{(item.employee?.name||'?').trim().charAt(0).toUpperCase()}</div><div className="managerAdvances-rowText"><strong>{item.employee?.name || '—'}</strong>{item.note?<span>{item.note}</span>:<span>{item.employee?.email || ''}</span>}</div><div className="managerAdvances-rowAmount"><strong>− {formatCzk(item.amountCzk, locale)}</strong><button type="button" disabled={deleteState.isLoading} onClick={()=>handleDelete(item.id)}>{copy.delete}</button></div></article>)}</div>):<div className="managerAdvances-empty">{copy.empty}</div>}</section>:null}
  </section>;
}
