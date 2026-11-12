import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useGetManagerTimesheetQuery, useSaveManagerTimesheetBulkMutation, useSaveManagerTimesheetCellMutation } from '../../features/worktrack/managerTimesheetApi.js';
import './ManagerTimesheetPage.css';

const COPY = {
  uk: { outside:'Інший місяць', missingManager:'Немає запису менеджера', missingEmployee:'Немає запису працівника', hours:'години', break:'перерва', project:'об’єкт', difference:'Різниця', mismatch:'Невідповідність', matchTitle:'Усе збігається', matchText:'Записи менеджера і працівника збігаються.', yourMissing:'Немає вашого запису', employeeRecorded:'Працівник записав', yourTimesheet:'У вашому табелі є', hoursMismatch:'Не збігаються години', breakMismatch:'Не збігається перерва', projectMismatch:'Не збігається об’єкт', notSpecified:'не вказано', back:'Назад до погодження', previousMonth:'Попередній місяць', nextMonth:'Наступний місяць', matched:'Збігається', mismatches:'Розбіжності', missing:'Без запису', loading:'Завантаження…', employee:'Працівник', total:'Разом', ownRow:'Власний контрольний рядок може редагувати інший менеджер', empty:'Немає записів для цього місяця.', close:'Закрити', you:'Ви', yourHours:'Ваші години', lunch:'Перерва, хв', projectLabel:'Об’єкт', clear:'Очистити', cancel:'Скасувати', saving:'Збереження…', saveReturn:'Зберегти й повернутись', save:'Зберегти', quickFill:'Швидке заповнення', quickFillTitle:'Заповнити кілька комірок', quickFillHint:'Виберіть працівників і дні. За замовчуванням заповнюються лише порожні комірки.', selectAll:'Усі', selectDays:'Дні', selectEmployees:'Працівники', onlyEmpty:'Лише порожні комірки', overwrite:'Перезаписати наявні записи', selectedCells:'Буде заповнено комірок', applyFill:'Заповнити', noSelection:'Виберіть хоча б одного працівника і день.', fillDone:'Заповнено', fillFailed:'Не вдалося виконати швидке заповнення.' },
  cs: { outside:'Mimo tento měsíc', missingManager:'Chybí záznam vedoucího', missingEmployee:'Chybí záznam zaměstnance', hours:'hodiny', break:'přestávka', project:'projekt', difference:'Rozdíl', mismatch:'Nesrovnalost', matchTitle:'Vše souhlasí', matchText:'Záznamy vedoucího a zaměstnance se shodují.', yourMissing:'Chybí váš záznam', employeeRecorded:'Zaměstnanec zaznamenal', yourTimesheet:'Ve vašem výkazu je', hoursMismatch:'Hodiny se neshodují', breakMismatch:'Přestávka se neshoduje', projectMismatch:'Projekt se neshoduje', notSpecified:'neuvedeno', back:'Zpět na schvalování', previousMonth:'Předchozí měsíc', nextMonth:'Další měsíc', matched:'Shoduje se', mismatches:'Rozdíly', missing:'Bez záznamu', loading:'Načítání…', employee:'Zaměstnanec', total:'Celkem', ownRow:'Tento kontrolní řádek může upravit jiný vedoucí', empty:'Pro tento měsíc nejsou žádné záznamy.', close:'Zavřít', you:'Vy', yourHours:'Vaše hodiny', lunch:'Přestávka (min)', projectLabel:'Projekt', clear:'Vymazat', cancel:'Zrušit', saving:'Ukládání…', saveReturn:'Uložit a vrátit se', save:'Uložit', quickFill:'Rychlé vyplnění', quickFillTitle:'Vyplnit více buněk', quickFillHint:'Vyberte zaměstnance a dny. Ve výchozím stavu se vyplní pouze prázdné buňky.', selectAll:'Všichni', selectDays:'Dny', selectEmployees:'Zaměstnanci', onlyEmpty:'Pouze prázdné buňky', overwrite:'Přepsat existující záznamy', selectedCells:'Vyplní se buněk', applyFill:'Vyplnit', noSelection:'Vyberte alespoň jednoho zaměstnance a den.', fillDone:'Vyplněno', fillFailed:'Rychlé vyplnění se nepodařilo.' },
  en: { outside:'Outside this month', missingManager:'Missing manager entry', missingEmployee:'Missing employee entry', hours:'hours', break:'break', project:'project', difference:'Difference', mismatch:'Mismatch', matchTitle:'All entries match', matchText:'The manager and employee entries match.', yourMissing:'Your entry is missing', employeeRecorded:'Employee recorded', yourTimesheet:'Your timesheet has', hoursMismatch:'Hours do not match', breakMismatch:'Breaks do not match', projectMismatch:'Projects do not match', notSpecified:'not specified', back:'Back to approvals', previousMonth:'Previous month', nextMonth:'Next month', matched:'Matches', mismatches:'Mismatches', missing:'Missing entries', loading:'Loading…', employee:'Employee', total:'Total', ownRow:'Another manager can edit this self-review row', empty:'No entries for this month.', close:'Close', you:'You', yourHours:'Your hours', lunch:'Break (min)', projectLabel:'Project', clear:'Clear', cancel:'Cancel', saving:'Saving…', saveReturn:'Save and return', save:'Save', quickFill:'Quick fill', quickFillTitle:'Fill multiple cells', quickFillHint:'Choose employees and days. Only empty cells are filled by default.', selectAll:'All', selectDays:'Days', selectEmployees:'Employees', onlyEmpty:'Only empty cells', overwrite:'Overwrite existing entries', selectedCells:'Cells to fill', applyFill:'Fill cells', noSelection:'Select at least one employee and one day.', fillDone:'Filled', fillFailed:'Quick fill failed.' },
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(value, amount) {
  const [year, month] = value.split('-').map(Number);
  const d = new Date(year, month - 1 + amount, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value, locale) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function cellClass(status) {
  return `managerTimesheetCell is-${String(status || 'EMPTY').toLowerCase().replaceAll('_', '-')}`;
}

function problemLabel(day, copy) {
  if (day.isCurrentMonth === false) return copy.outside;
  if (day.status === 'MISSING_MANAGER') return copy.missingManager;
  if (day.status === 'MISSING_EMPLOYEE') return copy.missingEmployee;
  const labels = [];
  if (day.reasons?.includes('hours')) labels.push(copy.hours);
  if (day.reasons?.includes('break')) labels.push(copy.break);
  if (day.reasons?.includes('project')) labels.push(copy.project);
  return labels.length ? `${copy.difference}: ${labels.join(', ')}` : copy.mismatch;
}

function displayEmployeeHours(day) {
  return day?.employeeNetHours ?? day?.employeeHours ?? null;
}

function displayManagerHours(day) {
  return day?.managerNetHours ?? day?.managerHours ?? null;
}

function displayDifference(day) {
  return day?.netDifference ?? day?.difference ?? null;
}

function displayManagerTotal(row) {
  return row?.managerNetTotal ?? row?.managerTotal ?? 0;
}

function emptyTimesheetDay(day) {
  return {
    date: day.date,
    day: day.day,
    isCurrentMonth: day.isCurrentMonth,
    status: day.isCurrentMonth === false ? 'OUTSIDE_MONTH' : 'EMPTY',
    reasons: [],
    employeeHours: null,
    employeeNetHours: null,
    managerHours: null,
    managerNetHours: null,
    difference: null,
    netDifference: null,
    employeeBreakMinutes: null,
    managerBreakMinutes: null,
    employeeProjects: [],
    employeeProjectIds: [],
    managerProjectId: null,
    note: '',
  };
}

function normalizeTimesheetRows(data) {
  const sourceRows = Array.isArray(data?.rows) ? data.rows : [];
  const calendarDays = Array.isArray(data?.days) && data.days.length
    ? data.days
    : sourceRows[0]?.days || [];
  if (!calendarDays.length || !data?.compact) return { rows: sourceRows, days: calendarDays };

  return {
    days: calendarDays,
    rows: sourceRows.map(row => {
      const daysByDate = new Map((row.days || []).map(day => [day.date, day]));
      return {
        ...row,
        days: calendarDays.map(day => daysByDate.get(day.date) || emptyTimesheetDay(day)),
      };
    }),
  };
}

function problemDetails(day, copy) {
  if (day.status === 'EMPTY' || day.status === 'OUTSIDE_MONTH') return [];
  if (day.status === 'MATCH') return [{ tone: 'ok', title: copy.matchTitle, text: copy.matchText }];
  if (day.status === 'MISSING_MANAGER') return [{ tone: 'warning', title: copy.yourMissing, text: `${copy.employeeRecorded} ${displayEmployeeHours(day) ?? '—'} h.` }];
  if (day.status === 'MISSING_EMPLOYEE') return [{ tone: 'warning', title: copy.missingEmployee, text: `${copy.yourTimesheet} ${displayManagerHours(day) ?? '—'} h.` }];

  const details = [];
  if (day.reasons?.includes('hours')) details.push({
    tone: 'danger',
    title: copy.hoursMismatch,
    text: `${copy.employee} ${displayEmployeeHours(day) ?? '—'} · ${copy.you} ${displayManagerHours(day) ?? '—'}${displayDifference(day) == null ? '' : ` · ${displayDifference(day) > 0 ? '+' : ''}${displayDifference(day)} h`}`,
  });
  if (day.reasons?.includes('break')) details.push({
    tone: 'danger',
    title: copy.breakMismatch,
    text: `${copy.employee} ${day.employeeBreakMinutes ?? 0} min · ${copy.you} ${day.managerBreakMinutes ?? 0} min`,
  });
  if (day.reasons?.includes('project')) details.push({
    tone: 'danger',
    title: copy.projectMismatch,
    text: `${copy.employee}: ${day.employeeProjects?.join(', ') || copy.notSpecified}`,
  });
  return details;
}

function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => `${part[0]?.toUpperCase() || ''}.`).join(' ');
}

function weekLabel(week, locale) {
  if (!week.length) return '';
  const first = new Date(`${week[0].date}T12:00:00`);
  const last = new Date(`${week.at(-1).date}T12:00:00`);
  const firstMonth = new Intl.DateTimeFormat(locale, { month: 'long' }).format(first);
  const lastMonth = new Intl.DateTimeFormat(locale, { month: 'long' }).format(last);
  if (first.getMonth() === last.getMonth()) return `${first.getDate()}–${last.getDate()} ${lastMonth}`;
  return `${first.getDate()} ${firstMonth} — ${last.getDate()} ${lastMonth}`;
}

export function ManagerTimesheetPage() {
  const { language } = useI18n();
  const locale = language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA';
  const copy = COPY[language] || COPY.uk;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetEmployeeId = searchParams.get('employee') || '';
  const targetDate = searchParams.get('date') || '';
  const openedFromApprovals = searchParams.get('from') === 'approvals';
  const targetMonth = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate.slice(0, 7) : '';
  const deepLinkHandled = useRef(false);

  const [month, setMonth] = useState(targetMonth || currentMonth);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [quickFillOpen, setQuickFillOpen] = useState(false);
  const [quickFillEmployees, setQuickFillEmployees] = useState([]);
  const [quickFillDates, setQuickFillDates] = useState([]);
  const [quickFillHours, setQuickFillHours] = useState('8');
  const [quickFillBreak, setQuickFillBreak] = useState('30');
  const [quickFillProject, setQuickFillProject] = useState('');
  const [quickFillOverwrite, setQuickFillOverwrite] = useState(false);
  const [quickFillMessage, setQuickFillMessage] = useState('');

  const { data, error, isFetching } = useGetManagerTimesheetQuery(month);
  const [saveCell, { isLoading: isSaving, error: saveError }] = useSaveManagerTimesheetCellMutation();
  const [saveBulk, { isLoading: isBulkSaving, error: bulkSaveError }] = useSaveManagerTimesheetBulkMutation();

  const { rows, days } = useMemo(() => normalizeTimesheetRows(data), [data]);
  const summary = data?.summary || {};
  const projects = data?.projects || [];
  const label = useMemo(() => monthLabel(month, locale), [month, locale]);
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);
  const safeWeekIndex = Math.min(weekIndex, Math.max(weeks.length - 1, 0));
  const mobileWeek = weeks[safeWeekIndex] || [];
  const editableRows = useMemo(() => rows.filter(row => row.canEdit !== false), [rows]);
  const quickFillTargets = useMemo(() => {
    const employees = new Set(quickFillEmployees);
    const dates = new Set(quickFillDates);
    return rows.flatMap(row => {
      if (!employees.has(row.employeeId)) return [];
      return row.days.filter(day => dates.has(day.date) && day.isCurrentMonth !== false && (
        quickFillOverwrite || (day.managerHours == null && day.managerBreakMinutes == null && !day.managerProjectId)
      )).map(day => ({ employeeId: row.employeeId, date: day.date, hours: quickFillHours, breakMinutes: quickFillBreak, projectId: quickFillProject }));
    });
  }, [rows, quickFillEmployees, quickFillDates, quickFillHours, quickFillBreak, quickFillProject, quickFillOverwrite]);

  function changeMonth(amount) {
    deepLinkHandled.current = true;
    setMonth(value => shiftMonth(value, amount));
    setWeekIndex(0);
  }

  function openQuickFill() {
    setQuickFillEmployees(editableRows.map(row => row.employeeId));
    setQuickFillDates(days.filter(day => day.isCurrentMonth !== false && new Date(`${day.date}T12:00:00`).getDay() % 6 !== 0).map(day => day.date));
    setQuickFillHours('8');
    setQuickFillBreak('30');
    setQuickFillProject('');
    setQuickFillOverwrite(false);
    setQuickFillMessage('');
    setQuickFillOpen(true);
  }

  async function submitQuickFill(event) {
    event.preventDefault();
    setQuickFillMessage('');
    if (!quickFillTargets.length) {
      setQuickFillMessage(copy.noSelection);
      return;
    }
    try {
      const result = await saveBulk(quickFillTargets).unwrap();
      setQuickFillMessage(`${copy.fillDone}: ${result.saved}`);
      setQuickFillOpen(false);
    } catch (requestError) {
      setQuickFillMessage(getApiErrorMessage(requestError) || copy.fillFailed);
    }
  }

  function openCell(row, day) {
    if (row.canEdit === false || day?.isCurrentMonth === false) return;
    setSelected({ row, day });
    setHours(day.managerHours == null ? '' : String(day.managerHours));
    setBreakMinutes(day.managerBreakMinutes == null ? '' : String(day.managerBreakMinutes));
    setProjectId(day.managerProjectId || '');
  }

  useEffect(() => {
    if (deepLinkHandled.current || isFetching || !targetEmployeeId || !targetDate || !rows.length) return;
    if (targetMonth && month !== targetMonth) {
      setMonth(targetMonth);
      setWeekIndex(0);
      return;
    }

    const row = rows.find(item => item.employeeId === targetEmployeeId);
    const day = row?.days?.find(item => item.date === targetDate);
    if (!row || !day || day.isCurrentMonth === false) return;

    const targetWeek = weeks.findIndex(week => week.some(item => item.date === targetDate));
    if (targetWeek >= 0) setWeekIndex(targetWeek);
    openCell(row, day);
    deepLinkHandled.current = true;
  }, [isFetching, month, rows, targetDate, targetEmployeeId, targetMonth, weeks]);

  async function submitCell(event) {
    event.preventDefault();
    if (!selected || selected.day?.isCurrentMonth === false) return;
    await saveCell({
      employeeId: selected.row.employeeId,
      date: selected.day.date,
      hours,
      breakMinutes,
      projectId,
    }).unwrap();
    setSelected(null);
    if (openedFromApprovals) navigate('/approvals');
  }

  async function clearCell() {
    if (!selected || selected.day?.isCurrentMonth === false) return;
    await saveCell({
      employeeId: selected.row.employeeId,
      date: selected.day.date,
      hours: '',
      breakMinutes: '',
      projectId: '',
    }).unwrap();
    setSelected(null);
    if (openedFromApprovals) navigate('/approvals');
  }

  const selectedProblems = selected ? problemDetails(selected.day, copy) : [];
  const selectedReasons = selected?.day?.reasons || [];

  return <section className="managerTimesheetPage pageStack">
    {openedFromApprovals ? <button className="managerTimesheetApprovalBack" type="button" onClick={() => navigate('/approvals')}>‹ {copy.back}</button> : null}

    <section className="managerTimesheetToolbar screenCard">
      <button type="button" onClick={() => changeMonth(-1)} aria-label={copy.previousMonth}>‹</button>
      <strong>{label}</strong>
      <button type="button" onClick={() => changeMonth(1)} disabled={month >= currentMonth()} aria-label={copy.nextMonth}>›</button>
    </section>

    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

    <section className="managerTimesheetSummary">
      <article className="is-ok"><span>{copy.matched}</span><strong>{summary.matched || 0}</strong></article>
      <article className="is-warning"><span>{copy.mismatches}</span><strong>{summary.mismatches || 0}</strong></article>
      <article><span>{copy.missing}</span><strong>{summary.missing || 0}</strong></article>
    </section>

    {isFetching ? <p className="statusNote">{copy.loading}</p> : null}

    {!isFetching && rows.length ? <>
      <div className="managerTimesheetQuickActions">
        <button type="button" className="managerTimesheetQuickTrigger" onClick={openQuickFill}><SvgIcon name="plus" />{copy.quickFill}</button>
        {quickFillMessage && !quickFillOpen ? <span role="status">{quickFillMessage}</span> : null}
      </div>
      <section className="managerTimesheetDesktop screenCard">
        <div className="managerTimesheetScroll">
          <table>
            <thead><tr><th className="employeeColumn">{copy.employee}</th>{days.map(day => <th className={day.isCurrentMonth === false ? 'is-outside-month' : ''} key={day.date}><span>{day.day}</span><small>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></th>)}<th className="totalColumn">{copy.total}</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.employeeId}>
              <th className="employeeColumn"><span className="employeeName">{row.name}</span>{row.problems ? <small className="employeeProblems">⚠ {row.problems}</small> : <small className="employeeOk">✓</small>}</th>
              {row.days.map(day => <td key={day.date}><button type="button" className={cellClass(day.status)} disabled={row.canEdit === false || day.isCurrentMonth === false} onClick={() => openCell(row, day)} title={day.isCurrentMonth === false ? copy.outside : row.canEdit === false ? copy.ownRow : problemLabel(day, copy)}>{displayManagerHours(day) ?? '—'}</button></td>)}
              <td className="totalColumn"><strong>{displayManagerTotal(row)}</strong><small> h</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="managerTimesheetMobile screenCard">
        <div className="managerTimesheetWeekNav">
          <button type="button" onClick={() => setWeekIndex(i => Math.max(0, i - 1))} disabled={safeWeekIndex === 0}>‹</button>
          <strong>{weekLabel(mobileWeek, locale)}</strong>
          <button type="button" onClick={() => setWeekIndex(i => Math.min(weeks.length - 1, i + 1))} disabled={safeWeekIndex >= weeks.length - 1}>›</button>
        </div>

        <div className="managerTimesheetMobileTable">
          <div className="managerTimesheetMobileHead">
            <span>{copy.employee}</span>
            {mobileWeek.map(day => <span className={day.isCurrentMonth === false ? 'is-outside-month' : ''} key={day.date}><b>{day.day}</b><small>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></span>)}
            <span>{copy.total}</span>
          </div>

          {rows.map(row => <div className="managerTimesheetMobileRow" key={row.employeeId}>
            <div className="managerTimesheetMobileEmployee"><strong>{initials(row.name)}</strong><small className={row.problems ? 'hasProblems' : 'isOk'}>{row.problems ? `⚠ ${row.problems}` : '✓'}</small></div>
            {mobileWeek.map(day => {
              const entry = row.days.find(item => item.date === day.date) || day;
              const outsideMonth = entry.isCurrentMonth === false;
              return <button type="button" key={day.date} className={cellClass(entry.status)} disabled={outsideMonth || row.canEdit === false} onClick={() => openCell(row, entry)} aria-label={`${row.name}, ${day.date}: ${outsideMonth ? copy.outside : row.canEdit === false ? copy.ownRow : problemLabel(entry, copy)}`}>{outsideMonth ? '—' : displayManagerHours(entry) ?? '—'}</button>;
            })}
            <div className="managerTimesheetMobileTotal"><strong>{displayManagerTotal(row)}</strong><small>h</small></div>
          </div>)}
        </div>
      </section>
    </> : null}

    {!isFetching && !rows.length ? <section className="screenCard managerTimesheetEmpty">{copy.empty}</section> : null}

    {quickFillOpen ? <div className="managerTimesheetModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isBulkSaving) setQuickFillOpen(false); }}>
      <form className="managerTimesheetModal managerTimesheetQuickModal screenCard" onSubmit={submitQuickFill}>
        <div className="managerTimesheetModalHead"><div><span>{label}</span><h2>{copy.quickFillTitle}</h2></div><button type="button" onClick={() => setQuickFillOpen(false)} disabled={isBulkSaving} aria-label={copy.close}>×</button></div>
        <p className="managerTimesheetQuickHint">{copy.quickFillHint}</p>
        <fieldset className="managerTimesheetQuickSection">
          <legend>{copy.selectDays}</legend>
          <div className="managerTimesheetQuickDays">{days.filter(day => day.isCurrentMonth !== false).map(day => <label className={quickFillDates.includes(day.date) ? 'is-selected' : ''} key={day.date}><input type="checkbox" checked={quickFillDates.includes(day.date)} onChange={event => setQuickFillDates(current => event.target.checked ? [...current, day.date] : current.filter(date => date !== day.date))}/><span><b>{day.day}</b><small>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></span></label>)}</div>
        </fieldset>
        <fieldset className="managerTimesheetQuickSection">
          <legend>{copy.selectEmployees}</legend>
          <div className="managerTimesheetQuickEmployeeList">
            <label className="managerTimesheetQuickSelectAll"><input type="checkbox" checked={editableRows.length > 0 && quickFillEmployees.length === editableRows.length} onChange={event => setQuickFillEmployees(event.target.checked ? editableRows.map(row => row.employeeId) : [])}/><span>{copy.selectAll}</span></label>
            {editableRows.map(row => <label key={row.employeeId}><input type="checkbox" checked={quickFillEmployees.includes(row.employeeId)} onChange={event => setQuickFillEmployees(current => event.target.checked ? [...current, row.employeeId] : current.filter(id => id !== row.employeeId))}/><span>{row.name}</span></label>)}
          </div>
        </fieldset>
        <div className="managerTimesheetQuickFields">
          <label>{copy.yourHours}<input type="number" min="0.01" max="24" step="0.01" value={quickFillHours} onChange={event => setQuickFillHours(event.target.value)}/></label>
          <label>{copy.lunch}<input type="number" min="0" max="1440" step="1" value={quickFillBreak} onChange={event => setQuickFillBreak(event.target.value)}/></label>
        </div>
        <label className="managerTimesheetQuickProject">{copy.projectLabel}<select value={quickFillProject} onChange={event => setQuickFillProject(event.target.value)}><option value="">{copy.notSpecified}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="managerTimesheetQuickOverwrite"><input type="checkbox" checked={quickFillOverwrite} onChange={event => setQuickFillOverwrite(event.target.checked)}/><span>{copy.overwrite}</span></label>
        <div className="managerTimesheetQuickFooter"><span>{copy.selectedCells}: <strong>{quickFillTargets.length}</strong></span><button type="submit" className="primaryButton" disabled={isBulkSaving || !quickFillTargets.length}>{isBulkSaving ? copy.saving : copy.applyFill}</button></div>
        {quickFillMessage || bulkSaveError ? <p className="statusNote is-error" role="alert">{quickFillMessage || getApiErrorMessage(bulkSaveError)}</p> : null}
      </form>
    </div> : null}

    {selected ? <div className="managerTimesheetModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <form className="managerTimesheetModal screenCard" onSubmit={submitCell}>
        <div className="managerTimesheetModalHead"><div><span>{selected.day.date}</span><h2>{selected.row.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label={copy.close}>×</button></div>

        <section className="managerTimesheetCompare">
          <article><span>{copy.employee}</span><strong>{displayEmployeeHours(selected.day) ?? '—'} h</strong></article>
          <article><span>{copy.you}</span><strong>{displayManagerHours(selected.day) ?? '—'} h</strong></article>
          <article className={displayDifference(selected.day) ? 'is-difference' : ''}><span>{copy.difference}</span><strong>{displayDifference(selected.day) == null ? '—' : `${displayDifference(selected.day) > 0 ? '+' : ''}${displayDifference(selected.day)} h`}</strong></article>
        </section>

        {selectedProblems.length ? <section className="managerTimesheetIssueList">
          {selectedProblems.map(item => <article className={`managerTimesheetIssue is-${item.tone}`} key={`${item.title}:${item.text}`}><span>{item.tone === 'ok' ? '✓' : item.tone === 'warning' ? '!' : '×'}</span><div><strong>{item.title}</strong><small>{item.text}</small></div></article>)}
        </section> : null}

        <label className={selectedReasons.includes('hours') ? 'is-problem' : ''}>{copy.yourHours}<input inputMode="decimal" value={hours} onChange={event => setHours(event.target.value.replace(',', '.'))} placeholder="8" /></label>
        <label className={selectedReasons.includes('break') ? 'is-problem' : ''}>{copy.lunch}<input inputMode="numeric" value={breakMinutes} onChange={event => setBreakMinutes(event.target.value)} placeholder="30" /></label>
        <label className={selectedReasons.includes('project') ? 'is-problem' : ''}>{copy.projectLabel}<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">{copy.notSpecified}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>

        {selected.day.employeeProjects?.length ? <p className="managerTimesheetEmployeeMeta">{copy.employee}: {selected.day.employeeProjects.join(', ')} · {copy.break} {selected.day.employeeBreakMinutes ?? 0} min</p> : null}
        {saveError ? <p className="statusNote is-error">{getApiErrorMessage(saveError)}</p> : null}

        <div className="managerTimesheetModalActions">
          {selected.day.managerHours != null || selected.day.managerBreakMinutes != null || selected.day.managerProjectId ? <button type="button" className="dangerButton" onClick={clearCell} disabled={isSaving}>{copy.clear}</button> : null}
          <span className="managerTimesheetModalActionSpacer" />
          <button type="button" className="secondaryButton" onClick={() => setSelected(null)}>{copy.cancel}</button>
          <button type="submit" className="primaryButton" disabled={isSaving}>{isSaving ? copy.saving : openedFromApprovals ? copy.saveReturn : copy.save}</button>
        </div>
      </form>
    </div> : null}
  </section>;
}
