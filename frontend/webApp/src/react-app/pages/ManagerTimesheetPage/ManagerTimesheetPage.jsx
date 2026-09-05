import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useGetManagerTimesheetQuery, useSaveManagerTimesheetCellMutation } from '../../features/worktrack/managerTimesheetApi.js';
import './ManagerTimesheetPage.css';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(value, amount) {
  const [year, month] = value.split('-').map(Number);
  const d = new Date(year, month - 1 + amount, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function cellClass(status) {
  return `managerTimesheetCell is-${String(status || 'EMPTY').toLowerCase().replaceAll('_', '-')}`;
}

function problemLabel(day) {
  if (day.status === 'MISSING_MANAGER') return 'Немає запису менеджера';
  if (day.status === 'MISSING_EMPLOYEE') return 'Немає запису працівника';
  const labels = [];
  if (day.reasons?.includes('hours')) labels.push('години');
  if (day.reasons?.includes('break')) labels.push('обід');
  if (day.reasons?.includes('project')) labels.push('об’єкт');
  return labels.length ? `Різниця: ${labels.join(', ')}` : 'Невідповідність';
}

function problemDetails(day) {
  if (day.status === 'EMPTY') return [];
  if (day.status === 'MATCH') return [{ tone: 'ok', title: 'Все сходиться', text: 'Записи менеджера і працівника збігаються.' }];
  if (day.status === 'MISSING_MANAGER') return [{ tone: 'warning', title: 'Немає вашого запису', text: `Працівник записав ${day.employeeHours ?? '—'} год.` }];
  if (day.status === 'MISSING_EMPLOYEE') return [{ tone: 'warning', title: 'Немає запису працівника', text: `У вашому табелі є ${day.managerHours ?? '—'} год.` }];

  const details = [];
  if (day.reasons?.includes('hours')) details.push({
    tone: 'danger',
    title: 'Не сходяться години',
    text: `Працівник ${day.employeeHours ?? '—'} · Ви ${day.managerHours ?? '—'}${day.difference == null ? '' : ` · ${day.difference > 0 ? '+' : ''}${day.difference} год`}`,
  });
  if (day.reasons?.includes('break')) details.push({
    tone: 'danger',
    title: 'Не сходиться обід',
    text: `Працівник ${day.employeeBreakMinutes ?? 0} хв · Ви ${day.managerBreakMinutes ?? 0} хв`,
  });
  if (day.reasons?.includes('project')) details.push({
    tone: 'danger',
    title: 'Не сходиться об’єкт',
    text: `Працівник: ${day.employeeProjects?.join(', ') || 'не вказано'}`,
  });
  return details;
}

function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => `${part[0]?.toUpperCase() || ''}.`).join(' ');
}

function weekLabel(week) {
  if (!week.length) return '';
  const first = new Date(`${week[0].date}T12:00:00`);
  const last = new Date(`${week.at(-1).date}T12:00:00`);
  const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long' }).format(last);
  return `${first.getDate()}–${last.getDate()} ${monthName}`;
}

export function ManagerTimesheetPage() {
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

  const { data, error, isFetching } = useGetManagerTimesheetQuery(month);
  const [saveCell, { isLoading: isSaving, error: saveError }] = useSaveManagerTimesheetCellMutation();

  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const projects = data?.projects || [];
  const days = rows[0]?.days || [];
  const label = useMemo(() => monthLabel(month), [month]);
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);
  const safeWeekIndex = Math.min(weekIndex, Math.max(weeks.length - 1, 0));
  const mobileWeek = weeks[safeWeekIndex] || [];

  function changeMonth(amount) {
    deepLinkHandled.current = true;
    setMonth(value => shiftMonth(value, amount));
    setWeekIndex(0);
  }

  function openCell(row, day) {
    if (row.canEdit === false) return;
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
    if (!row || !day) return;

    const targetWeek = weeks.findIndex(week => week.some(item => item.date === targetDate));
    if (targetWeek >= 0) setWeekIndex(targetWeek);
    openCell(row, day);
    deepLinkHandled.current = true;
  }, [isFetching, month, rows, targetDate, targetEmployeeId, targetMonth, weeks]);

  async function submitCell(event) {
    event.preventDefault();
    if (!selected) return;
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
    if (!selected) return;
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

  const selectedProblems = selected ? problemDetails(selected.day) : [];
  const selectedReasons = selected?.day?.reasons || [];

  return <section className="managerTimesheetPage pageStack">
    {openedFromApprovals ? <button className="managerTimesheetApprovalBack" type="button" onClick={() => navigate('/approvals')}>‹ Назад до погодження</button> : null}

    <section className="managerTimesheetToolbar screenCard">
      <button type="button" onClick={() => changeMonth(-1)} aria-label="Попередній місяць">‹</button>
      <strong>{label}</strong>
      <button type="button" onClick={() => changeMonth(1)} disabled={month >= currentMonth()} aria-label="Наступний місяць">›</button>
    </section>

    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

    <section className="managerTimesheetSummary">
      <article className="is-ok"><span>Збігається</span><strong>{summary.matched || 0}</strong></article>
      <article className="is-warning"><span>Розбіжності</span><strong>{summary.mismatches || 0}</strong></article>
      <article><span>Без запису</span><strong>{summary.missing || 0}</strong></article>
    </section>

    {isFetching ? <p className="statusNote">Завантаження…</p> : null}

    {!isFetching && rows.length ? <>
      <section className="managerTimesheetDesktop screenCard">
        <div className="managerTimesheetScroll">
          <table>
            <thead><tr><th className="employeeColumn">Працівник</th>{days.map(day => <th key={day.date}><span>{day.day}</span><small>{new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></th>)}<th className="totalColumn">Разом</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.employeeId}>
              <th className="employeeColumn"><span className="employeeName">{row.name}</span>{row.problems ? <small className="employeeProblems">⚠ {row.problems}</small> : <small className="employeeOk">✓</small>}</th>
              {row.days.map(day => <td key={day.date}><button type="button" className={cellClass(day.status)} disabled={row.canEdit === false} onClick={() => openCell(row, day)} title={row.canEdit === false ? 'Власний контрольний рядок редагує інший менеджер' : problemLabel(day)}>{day.managerHours ?? '—'}</button></td>)}
              <td className="totalColumn"><strong>{row.managerTotal}</strong><small> год</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="managerTimesheetMobile screenCard">
        <div className="managerTimesheetWeekNav">
          <button type="button" onClick={() => setWeekIndex(i => Math.max(0, i - 1))} disabled={safeWeekIndex === 0}>‹</button>
          <strong>{weekLabel(mobileWeek)}</strong>
          <button type="button" onClick={() => setWeekIndex(i => Math.min(weeks.length - 1, i + 1))} disabled={safeWeekIndex >= weeks.length - 1}>›</button>
        </div>

        <div className="managerTimesheetMobileTable">
          <div className="managerTimesheetMobileHead">
            <span>Працівник</span>
            {mobileWeek.map(day => <span key={day.date}><b>{day.day}</b><small>{new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></span>)}
            <span>Разом</span>
          </div>

          {rows.map(row => <div className="managerTimesheetMobileRow" key={row.employeeId}>
            <div className="managerTimesheetMobileEmployee"><strong>{initials(row.name)}</strong><small className={row.problems ? 'hasProblems' : 'isOk'}>{row.problems ? `⚠ ${row.problems}` : '✓'}</small></div>
            {mobileWeek.map(day => {
              const entry = row.days.find(item => item.date === day.date) || day;
              return <button type="button" key={day.date} className={cellClass(entry.status)} disabled={row.canEdit === false} onClick={() => openCell(row, entry)} aria-label={`${row.name}, ${day.date}: ${row.canEdit === false ? 'власний контрольний рядок редагує інший менеджер' : problemLabel(entry)}`}>{entry.managerHours ?? '—'}</button>;
            })}
            <div className="managerTimesheetMobileTotal"><strong>{row.managerTotal}</strong><small>год</small></div>
          </div>)}
        </div>
      </section>
    </> : null}

    {!isFetching && !rows.length ? <section className="screenCard managerTimesheetEmpty">Немає записів для цього місяця.</section> : null}

    {selected ? <div className="managerTimesheetModalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <form className="managerTimesheetModal screenCard" onSubmit={submitCell}>
        <div className="managerTimesheetModalHead"><div><span>{selected.day.date}</span><h2>{selected.row.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Закрити">×</button></div>

        <section className="managerTimesheetCompare">
          <article><span>Працівник</span><strong>{selected.day.employeeHours ?? '—'} год</strong></article>
          <article><span>Ви</span><strong>{selected.day.managerHours ?? '—'} год</strong></article>
          <article className={selected.day.difference ? 'is-difference' : ''}><span>Різниця</span><strong>{selected.day.difference == null ? '—' : `${selected.day.difference > 0 ? '+' : ''}${selected.day.difference} год`}</strong></article>
        </section>

        {selectedProblems.length ? <section className="managerTimesheetIssueList">
          {selectedProblems.map(item => <article className={`managerTimesheetIssue is-${item.tone}`} key={`${item.title}:${item.text}`}><span>{item.tone === 'ok' ? '✓' : item.tone === 'warning' ? '!' : '×'}</span><div><strong>{item.title}</strong><small>{item.text}</small></div></article>)}
        </section> : null}

        <label className={selectedReasons.includes('hours') ? 'is-problem' : ''}>Ваші години<input inputMode="decimal" value={hours} onChange={event => setHours(event.target.value.replace(',', '.'))} placeholder="8" /></label>
        <label className={selectedReasons.includes('break') ? 'is-problem' : ''}>Обід, хв<input inputMode="numeric" value={breakMinutes} onChange={event => setBreakMinutes(event.target.value)} placeholder="30" /></label>
        <label className={selectedReasons.includes('project') ? 'is-problem' : ''}>Об’єкт<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">Не вказано</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>

        {selected.day.employeeProjects?.length ? <p className="managerTimesheetEmployeeMeta">Працівник: {selected.day.employeeProjects.join(', ')} · обід {selected.day.employeeBreakMinutes ?? 0} хв</p> : null}
        {saveError ? <p className="statusNote is-error">{getApiErrorMessage(saveError)}</p> : null}

        <div className="managerTimesheetModalActions">
          {selected.day.managerHours != null || selected.day.managerBreakMinutes != null || selected.day.managerProjectId ? <button type="button" className="dangerButton" onClick={clearCell} disabled={isSaving}>Очистити</button> : null}
          <span className="managerTimesheetModalActionSpacer" />
          <button type="button" className="secondaryButton" onClick={() => setSelected(null)}>Скасувати</button>
          <button type="submit" className="primaryButton" disabled={isSaving}>{isSaving ? 'Збереження…' : openedFromApprovals ? 'Зберегти й повернутись' : 'Зберегти'}</button>
        </div>
      </form>
    </div> : null}
  </section>;
}