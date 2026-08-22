import { useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useGetProjectsQuery,
  useGetWeekEntriesQuery,
  useUpdateWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CalendarPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_PRIORITY = ['REJECTED', 'SUBMITTED', 'DRAFT', 'APPROVED'];
const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };
const QUICK_HOURS = [4, 6, 7.5, 8, 10, 12];
const COPY = {
  uk: { editDay:'Робочі години', project:'Проєкт / об’єкт', hours:'Години', add:'Додати запис', update:'Оновити запис', existing:'Записи цього дня', noProjects:'Немає активних проєктів', close:'Закрити', delete:'Видалити', locked:'Цей тиждень уже відправлено або погоджено. Редагування заблоковано.', tapHint:'Натисніть на дату, щоб додати або змінити години.', saved:'Години збережено' },
  cs: { editDay:'Pracovní hodiny', project:'Projekt / objekt', hours:'Hodiny', add:'Přidat záznam', update:'Aktualizovat záznam', existing:'Záznamy tohoto dne', noProjects:'Žádné aktivní projekty', close:'Zavřít', delete:'Smazat', locked:'Tento týden již byl odeslán nebo schválen. Úpravy jsou uzamčeny.', tapHint:'Klikněte na datum pro přidání nebo úpravu hodin.', saved:'Hodiny byly uloženy' },
  en: { editDay:'Work hours', project:'Project / site', hours:'Hours', add:'Add entry', update:'Update entry', existing:'Entries for this day', noProjects:'No active projects', close:'Close', delete:'Delete', locked:'This week has already been submitted or approved. Editing is locked.', tapHint:'Tap a date to add or edit hours.', saved:'Hours saved' },
};

function toDateKey(date) { return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10); }
function parseDateKey(value) { return new Date(`${value}T00:00:00.000Z`); }
function addDays(value, days) { return new Date(value.getTime() + days * DAY_MS); }
function getWeekStart(date) { const source = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = source.getUTCDay(); return addDays(source, day === 0 ? -6 : 1 - day); }
function weekStartKey(dateKey) { return toDateKey(getWeekStart(parseDateKey(dateKey))); }
function getMonthGridStart(monthDate) { return getWeekStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)); }
function shiftMonth(monthDate, amount) { return new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1); }
function formatMonth(monthDate, locale) { return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(monthDate); }
function formatLongDate(dateKey, locale) { return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDateKey(dateKey)); }
function getWeekdays(locale) { const monday = new Date('2026-08-17T00:00:00.000Z'); return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(addDays(monday, index)).replace('.', '')); }
function formatHours(value) { const totalMinutes = Math.round((Number(value) || 0) * 60); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; return `${hours}h ${String(minutes).padStart(2, '0')}m`; }
function getDayStatus(entries) { for (const status of STATUS_PRIORITY) if (entries.some(entry => entry.status === status)) return status; return ''; }
function getDayTotal(entries) { return entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); }
function dedupeEntries(weekResults) { const byId = new Map(); weekResults.forEach(result => (result.data?.entries || []).forEach(entry => byId.set(entry.id, entry))); return Array.from(byId.values()); }
function MonthStat({ label, value, tone = '' }) { return <article className={`workCalendarStat ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></article>; }

export function CalendarPage() {
  const { language, t } = useI18n(); const c = COPY[language] || COPY.uk; const locale = LOCALES[language] || LOCALES.uk;
  const weekdays = useMemo(() => getWeekdays(locale), [locale]); const today = useMemo(() => new Date(), []); const todayKey = useMemo(() => toDateKey(today), [today]);
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1)); const [selectedDateKey, setSelectedDateKey] = useState(todayKey); const [editorOpen, setEditorOpen] = useState(false); const [projectId, setProjectId] = useState(''); const [hours, setHours] = useState('8'); const [editingId, setEditingId] = useState(''); const [actionError, setActionError] = useState(''); const [actionMessage, setActionMessage] = useState('');
  const projectsQuery = useGetProjectsQuery(); const projects = (projectsQuery.data?.projects || []).filter(project => project.isActive);
  const [createEntry, createState] = useCreateWorkEntryMutation(); const [updateEntry, updateState] = useUpdateWorkEntryMutation(); const [deleteEntry, deleteState] = useDeleteWorkEntryMutation();

  const gridStart = useMemo(() => getMonthGridStart(monthDate), [monthDate]); const weekStarts = useMemo(() => Array.from({ length: 6 }, (_, index) => toDateKey(addDays(gridStart, index * 7))), [gridStart]);
  const week0 = useGetWeekEntriesQuery({ weekStart: weekStarts[0] }); const week1 = useGetWeekEntriesQuery({ weekStart: weekStarts[1] }); const week2 = useGetWeekEntriesQuery({ weekStart: weekStarts[2] }); const week3 = useGetWeekEntriesQuery({ weekStart: weekStarts[3] }); const week4 = useGetWeekEntriesQuery({ weekStart: weekStarts[4] }); const week5 = useGetWeekEntriesQuery({ weekStart: weekStarts[5] });
  const weekResults = [week0, week1, week2, week3, week4, week5];
  const entries = useMemo(() => dedupeEntries(weekResults), [week0.data, week1.data, week2.data, week3.data, week4.data, week5.data]);
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-`; const monthEntries = useMemo(() => entries.filter(entry => entry.workDate.startsWith(monthPrefix)), [entries, monthPrefix]);
  const entriesByDate = useMemo(() => { const map = new Map(); entries.forEach(entry => { const current = map.get(entry.workDate) || []; current.push(entry); map.set(entry.workDate, current); }); return map; }, [entries]);
  const calendarDays = useMemo(() => Array.from({ length: 42 }, (_, index) => { const date = addDays(gridStart, index); return { date, dateKey: toDateKey(date), inMonth: date.getUTCMonth() === monthDate.getMonth() }; }), [gridStart, monthDate]);
  const selectedEntries = entriesByDate.get(selectedDateKey) || []; const selectedHours = getDayTotal(selectedEntries); const selectedStatus = getDayStatus(selectedEntries); const selectedOvertime = Math.max(0, selectedHours - 8);
  const selectedWeek = weekStartKey(selectedDateKey); const selectedWeekResult = weekResults.find((_, index) => weekStarts[index] === selectedWeek); const submissionStatus = selectedWeekResult?.data?.submission?.status || ''; const locked = submissionStatus === 'SUBMITTED' || submissionStatus === 'APPROVED';
  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const totals = useMemo(() => { const total = monthEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const approved = monthEntries.filter(entry => entry.status === 'APPROVED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const submitted = monthEntries.filter(entry => entry.status === 'SUBMITTED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0); const daily = new Map(); monthEntries.forEach(entry => daily.set(entry.workDate, (daily.get(entry.workDate) || 0) + (Number(entry.hours) || 0))); const overtime = Array.from(daily.values()).reduce((sum, value) => sum + Math.max(0, value - 8), 0); return { total, approved, submitted, overtime }; }, [monthEntries]);
  const isLoading = weekResults.some(result => result.isLoading || result.isFetching); const firstError = weekResults.find(result => result.error)?.error; const hasCompleteCalendar = !isLoading && !firstError && weekResults.every(result => result.data); const statusLabel = status => t(`common.${String(status || 'draft').toLowerCase()}`);

  function changeMonth(amount) { const next = shiftMonth(monthDate, amount); setMonthDate(next); setSelectedDateKey(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1))); setEditorOpen(false); }
  function goToday() { setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDateKey(todayKey); }
  function openDay(dateKey) { setSelectedDateKey(dateKey); setEditingId(''); setProjectId(projects[0]?.id || ''); setHours('8'); setActionError(''); setActionMessage(''); setEditorOpen(true); }
  function editExisting(entry) { setEditingId(entry.id); setProjectId(entry.projectId || entry.project?.id || ''); setHours(String(entry.hours || '')); setActionError(''); setActionMessage(''); }
  function resetEditor() { setEditingId(''); setProjectId(projects[0]?.id || ''); setHours('8'); setActionError(''); setActionMessage(''); }
  async function saveEntry(event) { event.preventDefault(); if (locked || !projectId || Number(hours) <= 0) return; setActionError(''); setActionMessage(''); try { if (editingId) await updateEntry({ entryId: editingId, hours: String(hours), projectId }).unwrap(); else await createEntry({ workDate: selectedDateKey, hours: String(hours), projectId }).unwrap(); setActionMessage(c.saved); resetEditor(); } catch (error) { setActionError(getApiErrorMessage(error)); } }
  async function removeEntry(entryId) { if (locked) return; setActionError(''); try { await deleteEntry(entryId).unwrap(); if (editingId === entryId) resetEditor(); } catch (error) { setActionError(getApiErrorMessage(error)); } }

  return <section className="workCalendarPage pageStack">
    <header className="workCalendarHeader"><div><p className="sectionEyebrow">{t('calendar.eyebrow')}</p><h1>{t('calendar.title')}</h1><p>{c.tapHint}</p></div></header>
    <section className="workCalendarToolbar" aria-label={t('calendar.navigation')}><div className="workCalendarMonthNav"><button type="button" aria-label={t('calendar.previousMonth')} onClick={() => changeMonth(-1)}>←</button><strong>{formatMonth(monthDate, locale)}</strong><button type="button" aria-label={t('calendar.nextMonth')} onClick={() => changeMonth(1)}>→</button></div><button className="workCalendarToday" type="button" onClick={goToday}>{t('common.today')}</button></section>
    {isLoading ? <RequestLoadingState label={t('calendar.loading')} /> : null}{firstError ? <p className="statusNote is-error">{getApiErrorMessage(firstError)}</p> : null}
    {hasCompleteCalendar ? <>
      <section className="workCalendarStats" aria-label={t('calendar.monthSummary')}><MonthStat label={t('common.totalHours')} value={formatHours(totals.total)} /><MonthStat label={t('common.overtime')} value={formatHours(totals.overtime)} tone="overtime" /><MonthStat label={t('common.approved')} value={formatHours(totals.approved)} tone="approved" /><MonthStat label={t('common.submitted')} value={formatHours(totals.submitted)} tone="submitted" /></section>
      <section className="workCalendarCard"><div className="workCalendarWeekdays" aria-hidden="true">{weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="workCalendarGrid" role="grid" aria-label={formatMonth(monthDate, locale)}>{calendarDays.map(day => { const dayEntries = entriesByDate.get(day.dateKey) || []; const dayHours = getDayTotal(dayEntries); const status = getDayStatus(dayEntries); const overtime = Math.max(0, dayHours - 8); const isSelected = day.dateKey === selectedDateKey; const isToday = day.dateKey === todayKey; return <button className={['workCalendarDay', day.inMonth ? '' : 'is-outside', isSelected ? 'is-selected' : '', isToday ? 'is-today' : ''].filter(Boolean).join(' ')} type="button" role="gridcell" key={day.dateKey} onClick={() => openDay(day.dateKey)}><span className="workCalendarDay-number">{day.date.getUTCDate()}</span>{dayHours > 0 ? <strong>{formatHours(dayHours)}</strong> : <span className="workCalendarDay-empty">+</span>}<span className="workCalendarDay-indicators">{status ? <i className={`status-${status.toLowerCase()}`} title={statusLabel(status)} /> : null}{overtime > 0 ? <i className="status-overtime" title={t('common.overtime')} /> : null}</span></button>; })}</div><div className="workCalendarLegend"><span><i className="status-approved" />{t('common.approved')}</span><span><i className="status-submitted" />{t('common.submitted')}</span><span><i className="status-draft" />{t('common.draft')}</span><span><i className="status-rejected" />{t('common.rejected')}</span><span><i className="status-overtime" />{t('common.overtime')}</span></div></section>
      <section className="workCalendarDayPanel"><div className="workCalendarDayPanel-heading"><div><span>{formatLongDate(selectedDateKey, locale)}</span><h2>{formatHours(selectedHours)}</h2>{selectedOvertime > 0 ? <p>+{formatHours(selectedOvertime)} {t('calendar.overtimeSuffix')}</p> : null}</div>{selectedStatus ? <span className={`workCalendarStatus status-${selectedStatus.toLowerCase()}`}>{statusLabel(selectedStatus)}</span> : null}</div><div className="workCalendarEntries">{selectedEntries.length ? selectedEntries.map(entry => <article className="workCalendarEntry" key={entry.id}><span className={`workCalendarEntry-dot status-${entry.status.toLowerCase()}`} /><div><strong>{entry.project?.name || t('calendar.workEntry')}</strong><small>{statusLabel(entry.status)}</small></div><b>{formatHours(entry.hours)}</b></article>) : <p className="workCalendarEmpty">{t('calendar.noHours')}</p>}</div><button className="workCalendarPrimaryAction" type="button" onClick={() => openDay(selectedDateKey)}>{t('calendar.addEntry')}</button></section>
    </> : null}

    {editorOpen ? <div className="workHoursModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="workHoursModal" role="dialog" aria-modal="true"><header><div><span>{formatLongDate(selectedDateKey, locale)}</span><h2>{c.editDay}</h2></div><button type="button" aria-label={c.close} onClick={() => setEditorOpen(false)}>×</button></header><div className="workHoursModalBody">
      {selectedEntries.length ? <section className="workHoursExisting"><h3>{c.existing}</h3>{selectedEntries.map(entry => <article key={entry.id}><button className="workHoursExistingMain" type="button" disabled={locked} onClick={() => editExisting(entry)}><span><strong>{entry.project?.name || t('calendar.workEntry')}</strong><small>{statusLabel(entry.status)}</small></span><b>{formatHours(entry.hours)}</b></button>{!locked ? <button className="workHoursDelete" type="button" disabled={busy} onClick={() => removeEntry(entry.id)}>{c.delete}</button> : null}</article>)}</section> : null}
      {locked ? <p className="statusNote">{c.locked}</p> : <form className="workHoursForm" onSubmit={saveEntry}><label><span>{c.project}</span><select value={projectId || projects[0]?.id || ''} disabled={busy || !projects.length} onChange={event => setProjectId(event.target.value)}>{!projects.length ? <option value="">{c.noProjects}</option> : null}{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>{c.hours}</span><div className="workHoursNumber"><button type="button" onClick={() => setHours(String(Math.max(0, (Number(hours) || 0) - .5)))}>−</button><input inputMode="decimal" type="number" min="0" max="24" step="0.25" value={hours} onChange={event => setHours(event.target.value)} /><b>h</b><button type="button" onClick={() => setHours(String(Math.min(24, (Number(hours) || 0) + .5)))}>+</button></div></label><div className="workHoursQuick">{QUICK_HOURS.map(value => <button type="button" className={Number(hours) === value ? 'is-active' : ''} key={value} onClick={() => setHours(String(value))}>{value}h</button>)}</div>{actionError ? <p className="statusNote is-error">{actionError}</p> : null}{actionMessage ? <p className="statusNote is-success">{actionMessage}</p> : null}<button className="workHoursSave" type="submit" disabled={busy || !projects.length || Number(hours) <= 0}>{editingId ? c.update : c.add}</button>{editingId ? <button className="workHoursCancelEdit" type="button" onClick={resetEditor}>{c.add}</button> : null}</form>}
    </div></section></div> : null}
  </section>;
}
