import { useMemo, useState } from 'react';
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
  if (day.status === 'MATCH') return [{ tone: 'ok', title: 'Все сходиться', text: 'Контрольний запис відповідає даним працівника.' }];
  if (day.status === 'MISSING_MANAGER') return [{ tone: 'warning', title: 'Немає запису менеджера', text: `Працівник записав ${day.employeeHours ?? '—'} год. Додайте контрольний запис.` }];
  if (day.status === 'MISSING_EMPLOYEE') return [{ tone: 'warning', title: 'Немає запису працівника', text: `У табелі менеджера є ${day.managerHours ?? '—'} год, але працівник нічого не подав.` }];

  const details = [];
  if (day.reasons?.includes('hours')) {
    details.push({
      tone: 'danger',
      title: 'Не сходяться години',
      text: `Працівник: ${day.employeeHours ?? '—'} год · Менеджер: ${day.managerHours ?? '—'} год${day.difference == null ? '' : ` · Різниця: ${day.difference > 0 ? '+' : ''}${day.difference} год`}`,
    });
  }
  if (day.reasons?.includes('break')) {
    details.push({
      tone: 'danger',
      title: 'Не сходиться обід',
      text: `Працівник: ${day.employeeBreakMinutes ?? 0} хв · Менеджер: ${day.managerBreakMinutes ?? 0} хв`,
    });
  }
  if (day.reasons?.includes('project')) {
    details.push({
      tone: 'danger',
      title: 'Не сходиться об’єкт',
      text: `Працівник: ${day.employeeProjects?.join(', ') || 'не вказано'}`,
    });
  }
  return details;
}

export function ManagerTimesheetPage() {
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [filter, setFilter] = useState('all');
  const { data, error, isFetching } = useGetManagerTimesheetQuery(month);
  const [saveCell, { isLoading: isSaving, error: saveError }] = useSaveManagerTimesheetCellMutation();

  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const projects = data?.projects || [];
  const label = useMemo(() => monthLabel(month), [month]);
  const days = rows[0]?.days || [];

  const problems = useMemo(() => rows.flatMap(row => row.days
    .filter(day => !['MATCH', 'EMPTY'].includes(day.status))
    .map(day => ({ ...day, employeeId: row.employeeId, employeeName: row.name }))), [rows]);

  const visibleRows = filter === 'problems' ? rows.filter(row => row.problems > 0) : rows;

  function openCell(row, day) {
    setSelected({ row, day });
    setHours(day.managerHours == null ? '' : String(day.managerHours));
    setBreakMinutes(day.managerBreakMinutes == null ? '' : String(day.managerBreakMinutes));
    setProjectId(day.managerProjectId || '');
  }

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
  }

  const selectedProblems = selected ? problemDetails(selected.day) : [];
  const selectedReasons = selected?.day?.reasons || [];

  return <section className="managerTimesheetPage pageStack">
    <header className="managerTimesheetHeader appTop">
      <div className="appTitleBlock">
        <p className="sectionEyebrow">Контроль годин</p>
        <h1>Табель</h1>
        <p>Записуйте контрольні години менеджера та одразу бачте, де дані не сходяться з записами працівників.</p>
      </div>
      <button type="button" className={`managerTimesheetProblemsButton${filter === 'problems' ? ' is-active' : ''}`} onClick={() => setFilter(filter === 'problems' ? 'all' : 'problems')}>
        Перевірки {summary.problems ? `(${summary.problems})` : ''}
      </button>
    </header>

    <section className="managerTimesheetToolbar screenCard">
      <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Попередній місяць">‹</button>
      <strong>{label}</strong>
      <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonth()} aria-label="Наступний місяць">›</button>
    </section>

    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

    <section className="managerTimesheetSummary">
      <article><span>Працівники</span><strong>{summary.employees || 0}</strong></article>
      <article className="is-ok"><span>Збігається</span><strong>{summary.matched || 0}</strong></article>
      <article className="is-warning"><span>Невідповідності</span><strong>{summary.mismatches || 0}</strong></article>
      <article><span>Відсутні записи</span><strong>{summary.missing || 0}</strong></article>
    </section>

    {isFetching ? <p className="statusNote">Завантаження табеля…</p> : null}

    {!isFetching && visibleRows.length ? <>
      <section className="managerTimesheetDesktop screenCard">
        <div className="managerTimesheetScroll">
          <table>
            <thead><tr><th className="employeeColumn">Працівник</th>{days.map(day => <th key={day.date}><span>{day.day}</span><small>{new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(new Date(`${day.date}T00:00:00`))}</small></th>)}<th className="totalColumn">Разом</th></tr></thead>
            <tbody>{visibleRows.map(row => <tr key={row.employeeId}>
              <th className="employeeColumn"><span className="employeeName">{row.name}</span>{row.problems ? <small className="employeeProblems">{row.problems} проблем</small> : <small className="employeeOk">Все сходиться</small>}</th>
              {row.days.map(day => <td key={day.date}><button type="button" className={cellClass(day.status)} onClick={() => openCell(row, day)} title={problemLabel(day)}>{day.managerHours ?? '—'}</button></td>)}
              <td className="totalColumn"><strong>{row.managerTotal} год</strong><small className={Math.abs(row.difference) > 0.001 ? 'totalDiff is-bad' : 'totalDiff'}>{row.difference > 0 ? '+' : ''}{row.difference} год</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="managerTimesheetMobile">
        {visibleRows.map(row => <article className="managerTimesheetEmployeeCard screenCard" key={row.employeeId}>
          <div className="managerTimesheetEmployeeTop">
            <span><strong>{row.name}</strong><small>{row.problems ? `${row.problems} проблем` : 'Все сходиться'}</small></span>
            <span className="employeeHoursTotal">{row.managerTotal} год</span>
          </div>
          <div className="managerTimesheetMobileDays">{row.days.filter(day => day.managerHours != null || day.employeeHours != null).map(day => <button type="button" key={day.date} className={cellClass(day.status)} onClick={() => openCell(row, day)} aria-label={`${day.date}: ${problemLabel(day)}`}><span>{day.day}</span><strong>{day.managerHours ?? '—'}</strong></button>)}</div>
        </article>)}
      </section>
    </> : null}

    {!isFetching && !visibleRows.length ? <section className="screenCard managerTimesheetEmpty">Немає працівників або записів для цього місяця.</section> : null}

    {filter === 'problems' && problems.length ? <section className="managerTimesheetProblems screenCard">
      <div className="managerTimesheetProblemsHead"><div><span>Перевірки</span><strong>{problems.length}</strong></div><button type="button" onClick={() => setFilter('all')}>Показати весь табель</button></div>
      {problems.map(problem => <button type="button" className="managerTimesheetProblemRow" key={`${problem.employeeId}:${problem.date}`} onClick={() => {
        const row = rows.find(item => item.employeeId === problem.employeeId); if (row) openCell(row, problem);
      }}>
        <span><strong>{problem.employeeName}</strong><small>{new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(new Date(`${problem.date}T00:00:00`))}</small></span>
        <span><strong>{problemLabel(problem)}</strong><small>Працівник: {problem.employeeHours ?? '—'} · Менеджер: {problem.managerHours ?? '—'}</small></span>
        <b>›</b>
      </button>)}
    </section> : null}

    <div className="managerTimesheetLegend" aria-label="Легенда"><span className="is-match">Збігається</span><span className="is-mismatch">Невідповідність</span><span className="is-missing">Немає запису</span><span className="is-empty">Немає даних</span></div>

    {selected ? <div className="managerTimesheetModalBackdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <form className="managerTimesheetModal screenCard" onSubmit={submitCell}>
        <div className="managerTimesheetModalHead"><div><span>{selected.day.date}</span><h2>{selected.row.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Закрити">×</button></div>
        <section className="managerTimesheetCompare">
          <article><span>Працівник</span><strong>{selected.day.employeeHours ?? '—'} год</strong></article>
          <article><span>Менеджер</span><strong>{selected.day.managerHours ?? '—'} год</strong></article>
          <article className={selected.day.difference ? 'is-difference' : ''}><span>Різниця</span><strong>{selected.day.difference == null ? '—' : `${selected.day.difference > 0 ? '+' : ''}${selected.day.difference} год`}</strong></article>
        </section>

        {selectedProblems.length ? <section className="managerTimesheetIssueList" aria-label="Результат перевірки">
          {selectedProblems.map(item => <article className={`managerTimesheetIssue is-${item.tone}`} key={`${item.title}:${item.text}`}><span aria-hidden="true">{item.tone === 'ok' ? '✓' : item.tone === 'warning' ? '!' : '×'}</span><div><strong>{item.title}</strong><small>{item.text}</small></div></article>)}
        </section> : null}

        <label className={selectedReasons.includes('hours') ? 'is-problem' : ''}>Години менеджера<input inputMode="decimal" value={hours} onChange={event => setHours(event.target.value.replace(',', '.'))} placeholder="8" /></label>
        <label className={selectedReasons.includes('break') ? 'is-problem' : ''}>Обід, хв<input inputMode="numeric" value={breakMinutes} onChange={event => setBreakMinutes(event.target.value)} placeholder="30" /></label>
        <label className={selectedReasons.includes('project') ? 'is-problem' : ''}>Об’єкт<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">Не перевіряти об’єкт</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        {selected.day.employeeProjects?.length ? <p className="managerTimesheetEmployeeMeta">Працівник вказав: {selected.day.employeeProjects.join(', ')} · обід {selected.day.employeeBreakMinutes ?? 0} хв</p> : null}
        {saveError ? <p className="statusNote is-error">{getApiErrorMessage(saveError)}</p> : null}
        <div className="managerTimesheetModalActions">
          {selected.day.managerHours != null || selected.day.managerBreakMinutes != null || selected.day.managerProjectId ? <button type="button" className="dangerButton" onClick={clearCell} disabled={isSaving}>Очистити запис</button> : null}
          <span className="managerTimesheetModalActionSpacer" />
          <button type="button" className="secondaryButton" onClick={() => { setHours(selected.day.employeeHours == null ? '' : String(selected.day.employeeHours)); setBreakMinutes(selected.day.employeeBreakMinutes == null ? '' : String(selected.day.employeeBreakMinutes)); setProjectId(selected.day.employeeProjectIds?.length === 1 ? selected.day.employeeProjectIds[0] : ''); }}>Взяти дані працівника</button>
          <button type="submit" className="primaryButton" disabled={isSaving}>{isSaving ? 'Збереження…' : 'Зберегти'}</button>
        </div>
      </form>
    </div> : null}
  </section>;
}
