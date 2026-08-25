import { useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useGetProjectsQuery,
  useGetWeekEntriesQuery,
  useGetWorkRulesQuery,
  useUpdateWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CalendarPage.css';

const DAY_MS = 86400000;
const STATUS_PRIORITY = ['REJECTED', 'SUBMITTED', 'DRAFT', 'APPROVED'];
const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };
const COPY = {
  uk: { editDay:'Робочий запис', object:'Об’єкт', from:'Від', to:'До', note:'Нотатка', notePlaceholder:'Наприклад: монтаж, сервіс, додаткові роботи…', total:'Чистими', gross:'Фактично', break:'Обід', add:'Додати запис', update:'Зберегти зміни', existing:'Записи цього дня', noProjects:'Немає активних об’єктів', close:'Закрити', delete:'Видалити', clearDay:'Очистити день', clearForm:'Очистити форму', locked:'Цей тиждень уже відправлено або погоджено. Редагування заблоковано.', tapHint:'Натисніть на дату, щоб додати робочий час.', saved:'Запис збережено', deleted:'Запис видалено', cleared:'Записи за цей день очищено', invalidTime:'Перевірте час початку та завершення.', deleteConfirm:'Видалити цей робочий запис?', clearDayConfirm:'Видалити всі записи за цей день? Цю дію не можна скасувати.' },
  cs: { editDay:'Pracovní záznam', object:'Objekt', from:'Od', to:'Do', note:'Poznámka', notePlaceholder:'Např. montáž, servis, vícepráce…', total:'Čisté', gross:'Skutečně', break:'Oběd', add:'Přidat záznam', update:'Uložit změny', existing:'Záznamy tohoto dne', noProjects:'Žádné aktivní objekty', close:'Zavřít', delete:'Smazat', clearDay:'Vymazat den', clearForm:'Vymazat formulář', locked:'Tento týden již byl odeslán nebo schválen. Úpravy jsou uzamčeny.', tapHint:'Klikněte na datum pro přidání pracovní doby.', saved:'Záznam byl uložen', deleted:'Záznam byl smazán', cleared:'Záznamy pro tento den byly vymazány', invalidTime:'Zkontrolujte čas začátku a konce.', deleteConfirm:'Smazat tento pracovní záznam?', clearDayConfirm:'Smazat všechny záznamy pro tento den? Tuto akci nelze vrátit zpět.' },
  en: { editDay:'Work entry', object:'Project / site', from:'From', to:'To', note:'Note', notePlaceholder:'For example: installation, service, extra work…', total:'Net', gross:'Gross', break:'Lunch', add:'Add entry', update:'Save changes', existing:'Entries for this day', noProjects:'No active projects', close:'Close', delete:'Delete', clearDay:'Clear day', clearForm:'Clear form', locked:'This week has already been submitted or approved. Editing is locked.', tapHint:'Tap a date to add working time.', saved:'Entry saved', deleted:'Entry deleted', cleared:'Entries for this day were cleared', invalidTime:'Check the start and end time.', deleteConfirm:'Delete this work entry?', clearDayConfirm:'Delete all entries for this day? This action cannot be undone.' },
};

function toDateKey(date) { return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10); }
function parseDateKey(value) { return new Date(`${value}T00:00:00.000Z`); }
function addDays(value, days) { return new Date(value.getTime() + days * DAY_MS); }
function getWeekStart(date) { const source = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = source.getUTCDay(); return addDays(source, day === 0 ? -6 : 1 - day); }
function weekStartKey(dateKey) { return toDateKey(getWeekStart(parseDateKey(dateKey))); }
function getMonthGridStart(monthDate) { return getWeekStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)); }
function shiftMonth(monthDate, amount) { return new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1); }
function formatMonth(monthDate, locale) { return new Intl.DateTimeFormat(locale, { month:'long', year:'numeric' }).format(monthDate); }
function formatLongDate(dateKey, locale) { return new Intl.DateTimeFormat(locale, { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(parseDateKey(dateKey)); }
function getWeekdays(locale) { const monday = new Date('2026-08-17T00:00:00.000Z'); return Array.from({ length:7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday:'short', timeZone:'UTC' }).format(addDays(monday, index)).replace('.', '')); }
function formatHours(value) { const totalMinutes = Math.round((Number(value) || 0) * 60); return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`; }
function getDayStatus(entries) { for (const status of STATUS_PRIORITY) if (entries.some(entry => entry.status === status)) return status; return ''; }
function getDayTotal(entries) { return entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); }
function dedupeEntries(weekResults) { const byId = new Map(); weekResults.forEach(result => (result.data?.entries || []).forEach(entry => byId.set(entry.id, entry))); return Array.from(byId.values()); }
function timeToMinutes(value) { if (!/^\d{2}:\d{2}$/.test(value || '')) return null; const [h,m] = value.split(':').map(Number); if (h > 23 || m > 59) return null; return h * 60 + m; }
function calculateHours(startTime, endTime) { const start = timeToMinutes(startTime); let end = timeToMinutes(endTime); if (start == null || end == null) return 0; if (end <= start) end += 1440; return Math.round(((end - start) / 60) * 100) / 100; }
function MonthStat({ label, value, tone='' }) { return <article className={`workCalendarStat ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></article>; }

export function CalendarPage() {
  const { language, t } = useI18n();
  const c = COPY[language] || COPY.uk;
  const locale = LOCALES[language] || LOCALES.uk;
  const weekdays = useMemo(() => getWeekdays(locale), [locale]);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [editorOpen, setEditorOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:30');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const projectsQuery = useGetProjectsQuery();
  const { data:rulesData } = useGetWorkRulesQuery();
  const projects = (projectsQuery.data?.projects || []).filter(project => project.isActive);
  const [createEntry, createState] = useCreateWorkEntryMutation();
  const [updateEntry, updateState] = useUpdateWorkEntryMutation();
  const [deleteEntry, deleteState] = useDeleteWorkEntryMutation();
  const standardDailyHours = Number(rulesData?.workRules?.standardDailyHours || 8);
  const configuredBreakMinutes = Number(rulesData?.workRules?.breakMinutes || 0);

  const gridStart = useMemo(() => getMonthGridStart(monthDate), [monthDate]);
  const weekStarts = useMemo(() => Array.from({ length:6 }, (_, index) => toDateKey(addDays(gridStart, index * 7))), [gridStart]);
  const week0 = useGetWeekEntriesQuery({ weekStart:weekStarts[0] }); const week1 = useGetWeekEntriesQuery({ weekStart:weekStarts[1] }); const week2 = useGetWeekEntriesQuery({ weekStart:weekStarts[2] }); const week3 = useGetWeekEntriesQuery({ weekStart:weekStarts[3] }); const week4 = useGetWeekEntriesQuery({ weekStart:weekStarts[4] }); const week5 = useGetWeekEntriesQuery({ weekStart:weekStarts[5] });
  const weekResults = [week0, week1, week2, week3, week4, week5];
  const entries = useMemo(() => dedupeEntries(weekResults), [week0.data, week1.data, week2.data, week3.data, week4.data, week5.data]);
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-`;
  const monthEntries = useMemo(() => entries.filter(entry => entry.workDate.startsWith(monthPrefix)), [entries, monthPrefix]);
  const entriesByDate = useMemo(() => { const map = new Map(); entries.forEach(entry => { const current = map.get(entry.workDate) || []; current.push(entry); map.set(entry.workDate, current); }); return map; }, [entries]);
  const calendarDays = useMemo(() => Array.from({ length:42 }, (_, index) => { const date = addDays(gridStart, index); return { date, dateKey:toDateKey(date), inMonth:date.getUTCMonth() === monthDate.getMonth() }; }), [gridStart, monthDate]);
  const selectedEntries = entriesByDate.get(selectedDateKey) || [];
  const selectedHours = getDayTotal(selectedEntries);
  const selectedStatus = getDayStatus(selectedEntries);
  const selectedOvertime = Math.max(0, selectedHours - standardDailyHours);
  const selectedWeek = weekStartKey(selectedDateKey);
  const selectedWeekResult = weekResults.find((_, index) => weekStarts[index] === selectedWeek);
  const submissionStatus = selectedWeekResult?.data?.submission?.status || '';
  const locked = submissionStatus === 'SUBMITTED' || submissionStatus === 'APPROVED';
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;
  const calculatedGrossHours = calculateHours(startTime, endTime);
  const calculatedBreakMinutes = calculatedGrossHours > configuredBreakMinutes / 60 ? configuredBreakMinutes : 0;
  const calculatedNetHours = Math.max(0, calculatedGrossHours - calculatedBreakMinutes / 60);

  const totals = useMemo(() => { const total = monthEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const approved = monthEntries.filter(entry => entry.status === 'APPROVED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const submitted = monthEntries.filter(entry => entry.status === 'SUBMITTED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const daily = new Map(); monthEntries.forEach(entry => daily.set(entry.workDate, (daily.get(entry.workDate) || 0) + (Number(entry.hours) || 0))); const overtime = Array.from(daily.values()).reduce((sum, hours) => sum + Math.max(0, hours - standardDailyHours), 0); return { total, approved, submitted, overtime }; }, [monthEntries, standardDailyHours]);
  const isLoading = weekResults.some(result => result.isLoading || result.isFetching);
  const firstError = weekResults.find(result => result.error)?.error;
  const hasCompleteCalendar = !isLoading && !firstError && weekResults.every(result => result.data);
  const statusLabel = status => t(`common.${String(status || 'draft').toLowerCase()}`);

  function resetEditor() { setEditingId(''); setProjectId(projects[0]?.id || ''); setStartTime('07:00'); setEndTime('15:30'); setNote(''); setActionError(''); setActionMessage(''); }
  function clearForm() { setEditingId(''); setProjectId(projects[0]?.id || ''); setStartTime(''); setEndTime(''); setNote(''); setActionError(''); setActionMessage(''); }
  function openDay(dateKey) { setSelectedDateKey(dateKey); resetEditor(); setEditorOpen(true); }
  function editExisting(entry) { setEditingId(entry.id); setProjectId(entry.projectId || entry.project?.id || ''); setStartTime(entry.startTime || '07:00'); setEndTime(entry.endTime || '15:30'); setNote(entry.note || ''); setActionError(''); setActionMessage(''); }
  function changeMonth(amount) { const next = shiftMonth(monthDate, amount); setMonthDate(next); setSelectedDateKey(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1))); setEditorOpen(false); }
  function goToday() { setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDateKey(todayKey); }

  async function saveEntry(event) {
    event.preventDefault();
    if (locked || !projectId || calculatedGrossHours <= 0) { setActionError(c.invalidTime); return; }
    setActionError(''); setActionMessage('');
    const payload = { projectId, startTime, endTime, note };
    try {
      if (editingId) await updateEntry({ entryId:editingId, ...payload }).unwrap();
      else await createEntry({ workDate:selectedDateKey, ...payload }).unwrap();
      resetEditor();
      setActionMessage(c.saved);
    } catch (error) { setActionError(getApiErrorMessage(error)); }
  }

  async function removeEntry(entryId) {
    if (locked || busy || !window.confirm(c.deleteConfirm)) return;
    setActionError(''); setActionMessage('');
    try {
      await deleteEntry(entryId).unwrap();
      if (editingId === entryId) resetEditor();
      setActionMessage(c.deleted);
    } catch (error) { setActionError(getApiErrorMessage(error)); }
  }

  async function clearSelectedDay() {
    if (locked || busy || !selectedEntries.length || !window.confirm(c.clearDayConfirm)) return;
    setActionError(''); setActionMessage('');
    try {
      for (const entry of selectedEntries) await deleteEntry(entry.id).unwrap();
      resetEditor();
      setActionMessage(c.cleared);
    } catch (error) { setActionError(getApiErrorMessage(error)); }
  }

  return <section className="workCalendarPage pageStack">
    <header className="workCalendarHeader"><div><p className="sectionEyebrow">{t('calendar.eyebrow')}</p><h1>{t('calendar.title')}</h1><p>{c.tapHint}</p></div></header>
    <section className="workCalendarToolbar"><div className="workCalendarMonthNav"><button type="button" onClick={() => changeMonth(-1)}>←</button><strong>{formatMonth(monthDate, locale)}</strong><button type="button" onClick={() => changeMonth(1)}>→</button></div><button className="workCalendarToday" type="button" onClick={goToday}>{t('common.today')}</button></section>
    {isLoading ? <RequestLoadingState label={t('calendar.loading')} /> : null}{firstError ? <p className="statusNote is-error">{getApiErrorMessage(firstError)}</p> : null}
    {hasCompleteCalendar ? <>
      <section className="workCalendarStats"><MonthStat label={t('common.totalHours')} value={formatHours(totals.total)} /><MonthStat label={t('common.overtime')} value={formatHours(totals.overtime)} tone="overtime" /><MonthStat label={t('common.approved')} value={formatHours(totals.approved)} tone="approved" /><MonthStat label={t('common.submitted')} value={formatHours(totals.submitted)} tone="submitted" /></section>
      <section className="workCalendarCard"><div className="workCalendarWeekdays">{weekdays.map((day,index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="workCalendarGrid">{calendarDays.map(day => { const dayEntries = entriesByDate.get(day.dateKey) || []; const dayHours = getDayTotal(dayEntries); const status = getDayStatus(dayEntries); const overtime = Math.max(0, dayHours - standardDailyHours); return <button className={['workCalendarDay', day.inMonth ? '' : 'is-outside', day.dateKey === selectedDateKey ? 'is-selected' : '', day.dateKey === todayKey ? 'is-today' : ''].filter(Boolean).join(' ')} type="button" key={day.dateKey} onClick={() => openDay(day.dateKey)}><span className="workCalendarDay-number">{day.date.getUTCDate()}</span>{dayHours > 0 ? <strong>{formatHours(dayHours)}</strong> : <span className="workCalendarDay-empty">+</span>}<span className="workCalendarDay-indicators">{status ? <i className={`status-${status.toLowerCase()}`} /> : null}{overtime > 0 ? <i className="status-overtime" /> : null}</span></button>; })}</div></section>
      <section className="workCalendarDayPanel"><div className="workCalendarDayPanel-heading"><div><span>{formatLongDate(selectedDateKey, locale)}</span><h2>{formatHours(selectedHours)}</h2>{selectedOvertime > 0 ? <p>+{formatHours(selectedOvertime)} {t('calendar.overtimeSuffix')}</p> : null}</div>{selectedStatus ? <span className={`workCalendarStatus status-${selectedStatus.toLowerCase()}`}>{statusLabel(selectedStatus)}</span> : null}</div><div className="workCalendarEntries">{selectedEntries.length ? selectedEntries.map(entry => <article className="workCalendarEntry" key={entry.id}><span className={`workCalendarEntry-dot status-${entry.status.toLowerCase()}`} /><div><strong>{entry.project?.name || t('calendar.workEntry')}</strong><small>{entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : statusLabel(entry.status)}{Number(entry.breakMinutes)>0 ? ` · −${entry.breakMinutes}m ${c.break}` : ''}{entry.note ? ` · ${entry.note}` : ''}</small></div><b>{formatHours(entry.hours)}</b></article>) : <p className="workCalendarEmpty">{t('calendar.noHours')}</p>}</div><button className="workCalendarPrimaryAction" type="button" onClick={() => openDay(selectedDateKey)}>{t('calendar.addEntry')}</button></section>
    </> : null}

    {editorOpen ? <div className="workHoursModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="workHoursModal" role="dialog" aria-modal="true"><header><div><span>{formatLongDate(selectedDateKey, locale)}</span><h2>{c.editDay}</h2></div><button type="button" aria-label={c.close} onClick={() => setEditorOpen(false)}>×</button></header><div className="workHoursModalBody">
      {selectedEntries.length ? <section className="workHoursExisting"><div className="workHoursExistingHeader"><h3>{c.existing}</h3>{!locked ? <button className="workHoursClearDay" type="button" disabled={busy} onClick={clearSelectedDay}>{c.clearDay}</button> : null}</div>{selectedEntries.map(entry => <article key={entry.id}><button className="workHoursExistingMain" type="button" disabled={locked} onClick={() => editExisting(entry)}><span><strong>{entry.project?.name || t('calendar.workEntry')}</strong><small>{entry.startTime && entry.endTime ? `${entry.startTime}–${entry.endTime}` : formatHours(entry.hours)}{Number(entry.breakMinutes)>0 ? ` · −${entry.breakMinutes}m ${c.break}` : ''}{entry.note ? ` · ${entry.note}` : ''}</small></span><b>{formatHours(entry.hours)}</b></button>{!locked ? <button className="workHoursDelete" type="button" disabled={busy} onClick={() => removeEntry(entry.id)}>{c.delete}</button> : null}</article>)}</section> : null}
      {locked ? <p className="statusNote">{c.locked}</p> : <form className="workHoursForm" onSubmit={saveEntry}>
        <label><span>{c.object}</span><select value={projectId || projects[0]?.id || ''} disabled={busy || !projects.length} onChange={event => setProjectId(event.target.value)}>{!projects.length ? <option value="">{c.noProjects}</option> : null}{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <div className="workHoursTimeGrid"><label><span>{c.from}</span><input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} /></label><label><span>{c.to}</span><input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} /></label></div>
        <div className="workHoursCalculated"><span>{c.total}</span><strong>{calculatedNetHours > 0 ? formatHours(calculatedNetHours) : '—'}</strong></div>
        {calculatedGrossHours > 0 ? <p className="statusNote">{c.gross}: {formatHours(calculatedGrossHours)}{calculatedBreakMinutes > 0 ? ` · −${calculatedBreakMinutes}m ${c.break}` : ''}</p> : null}
        <label><span>{c.note}</span><textarea rows="3" maxLength="1200" value={note} placeholder={c.notePlaceholder} onChange={event => setNote(event.target.value)} /></label>
        {actionError ? <p className="statusNote is-error">{actionError}</p> : null}{actionMessage ? <p className="statusNote is-success">{actionMessage}</p> : null}
        <div className="workHoursFormActions"><button className="workHoursSave" type="submit" disabled={busy || !projects.length || calculatedGrossHours <= 0}>{editingId ? c.update : c.add}</button><button className="workHoursClearForm" type="button" disabled={busy} onClick={clearForm}>{c.clearForm}</button></div>
        {editingId ? <button className="workHoursCancelEdit" type="button" onClick={resetEditor}>{c.add}</button> : null}
      </form>}
    </div></section></div> : null}
  </section>;
}