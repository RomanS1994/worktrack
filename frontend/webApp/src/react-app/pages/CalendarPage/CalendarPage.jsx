import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetWeekEntriesQuery } from '../../features/worktrack/worktrackApi.js';
import './CalendarPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_PRIORITY = ['REJECTED', 'SUBMITTED', 'DRAFT', 'APPROVED'];
const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };

function toDateKey(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
}

function parseDateKey(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value, days) {
  return new Date(value.getTime() + days * DAY_MS);
}

function getWeekStart(date) {
  const source = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = source.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(source, offset);
}

function getMonthGridStart(monthDate) {
  return getWeekStart(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
}

function shiftMonth(monthDate, amount) {
  return new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1);
}

function formatMonth(monthDate, locale) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
}

function formatLongDate(dateKey, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateKey(dateKey));
}

function getWeekdays(locale) {
  const monday = new Date('2026-08-17T00:00:00.000Z');
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
      .format(addDays(monday, index))
      .replace('.', ''),
  );
}

function formatHours(value) {
  const totalMinutes = Math.round((Number(value) || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function getDayStatus(entries) {
  for (const status of STATUS_PRIORITY) {
    if (entries.some(entry => entry.status === status)) return status;
  }
  return '';
}

function getDayTotal(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
}

function dedupeEntries(weekResults) {
  const byId = new Map();
  weekResults.forEach(result => {
    (result.data?.entries || []).forEach(entry => byId.set(entry.id, entry));
  });
  return Array.from(byId.values());
}

function MonthStat({ label, value, tone = '' }) {
  return (
    <article className={`workCalendarStat ${tone ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function CalendarPage() {
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const weekdays = useMemo(() => getWeekdays(locale), [locale]);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const gridStart = useMemo(() => getMonthGridStart(monthDate), [monthDate]);
  const weekStarts = useMemo(
    () => Array.from({ length: 6 }, (_, index) => toDateKey(addDays(gridStart, index * 7))),
    [gridStart],
  );

  const week0 = useGetWeekEntriesQuery({ weekStart: weekStarts[0] });
  const week1 = useGetWeekEntriesQuery({ weekStart: weekStarts[1] });
  const week2 = useGetWeekEntriesQuery({ weekStart: weekStarts[2] });
  const week3 = useGetWeekEntriesQuery({ weekStart: weekStarts[3] });
  const week4 = useGetWeekEntriesQuery({ weekStart: weekStarts[4] });
  const week5 = useGetWeekEntriesQuery({ weekStart: weekStarts[5] });
  const weekResults = [week0, week1, week2, week3, week4, week5];

  const entries = useMemo(() => dedupeEntries(weekResults), [week0.data, week1.data, week2.data, week3.data, week4.data, week5.data]);
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-`;
  const monthEntries = useMemo(() => entries.filter(entry => entry.workDate.startsWith(monthPrefix)), [entries, monthPrefix]);

  const entriesByDate = useMemo(() => {
    const map = new Map();
    entries.forEach(entry => {
      const current = map.get(entry.workDate) || [];
      current.push(entry);
      map.set(entry.workDate, current);
    });
    return map;
  }, [entries]);

  const calendarDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      return { date, dateKey: toDateKey(date), inMonth: date.getUTCMonth() === monthDate.getMonth() };
    }),
    [gridStart, monthDate],
  );

  const selectedEntries = entriesByDate.get(selectedDateKey) || [];
  const selectedHours = getDayTotal(selectedEntries);
  const selectedStatus = getDayStatus(selectedEntries);
  const selectedOvertime = Math.max(0, selectedHours - 8);
  const selectedHoursHref = `/hours?date=${encodeURIComponent(selectedDateKey)}`;

  const totals = useMemo(() => {
    const total = monthEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    const approved = monthEntries.filter(entry => entry.status === 'APPROVED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    const submitted = monthEntries.filter(entry => entry.status === 'SUBMITTED').reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    const daily = new Map();
    monthEntries.forEach(entry => daily.set(entry.workDate, (daily.get(entry.workDate) || 0) + (Number(entry.hours) || 0)));
    const overtime = Array.from(daily.values()).reduce((sum, hours) => sum + Math.max(0, hours - 8), 0);
    return { total, approved, submitted, overtime };
  }, [monthEntries]);

  const isLoading = weekResults.some(result => result.isLoading || result.isFetching);
  const firstError = weekResults.find(result => result.error)?.error;
  const hasCompleteCalendar = !isLoading && !firstError && weekResults.every(result => result.data);
  const statusLabel = status => t(`common.${String(status || 'draft').toLowerCase()}`);

  function changeMonth(amount) {
    const next = shiftMonth(monthDate, amount);
    setMonthDate(next);
    setSelectedDateKey(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
  }

  function goToday() {
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(todayKey);
  }

  return (
    <section className="workCalendarPage pageStack">
      <header className="workCalendarHeader">
        <div>
          <p className="sectionEyebrow">{t('calendar.eyebrow')}</p>
          <h1>{t('calendar.title')}</h1>
          <p>{t('calendar.intro')}</p>
        </div>
      </header>

      <section className="workCalendarToolbar" aria-label={t('calendar.navigation')}>
        <div className="workCalendarMonthNav">
          <button type="button" aria-label={t('calendar.previousMonth')} onClick={() => changeMonth(-1)}>←</button>
          <strong>{formatMonth(monthDate, locale)}</strong>
          <button type="button" aria-label={t('calendar.nextMonth')} onClick={() => changeMonth(1)}>→</button>
        </div>
        <button className="workCalendarToday" type="button" onClick={goToday}>{t('common.today')}</button>
      </section>

      {isLoading ? <RequestLoadingState label={t('calendar.loading')} /> : null}
      {firstError ? <p className="statusNote is-error">{getApiErrorMessage(firstError)}</p> : null}

      {hasCompleteCalendar ? (
        <>
          <section className="workCalendarStats" aria-label={t('calendar.monthSummary')}>
            <MonthStat label={t('common.totalHours')} value={formatHours(totals.total)} />
            <MonthStat label={t('common.overtime')} value={formatHours(totals.overtime)} tone="overtime" />
            <MonthStat label={t('common.approved')} value={formatHours(totals.approved)} tone="approved" />
            <MonthStat label={t('common.submitted')} value={formatHours(totals.submitted)} tone="submitted" />
          </section>

          <section className="workCalendarCard">
            <div className="workCalendarWeekdays" aria-hidden="true">
              {weekdays.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
            </div>

            <div className="workCalendarGrid" role="grid" aria-label={formatMonth(monthDate, locale)}>
              {calendarDays.map(day => {
                const dayEntries = entriesByDate.get(day.dateKey) || [];
                const hours = getDayTotal(dayEntries);
                const status = getDayStatus(dayEntries);
                const overtime = Math.max(0, hours - 8);
                const isSelected = day.dateKey === selectedDateKey;
                const isToday = day.dateKey === todayKey;
                return (
                  <button
                    className={['workCalendarDay', day.inMonth ? '' : 'is-outside', isSelected ? 'is-selected' : '', isToday ? 'is-today' : ''].filter(Boolean).join(' ')}
                    type="button"
                    role="gridcell"
                    key={day.dateKey}
                    onClick={() => setSelectedDateKey(day.dateKey)}
                  >
                    <span className="workCalendarDay-number">{day.date.getUTCDate()}</span>
                    {hours > 0 ? <strong>{formatHours(hours)}</strong> : <span className="workCalendarDay-empty">0h</span>}
                    <span className="workCalendarDay-indicators">
                      {status ? <i className={`status-${status.toLowerCase()}`} title={statusLabel(status)} /> : null}
                      {overtime > 0 ? <i className="status-overtime" title={t('common.overtime')} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="workCalendarLegend" aria-label={t('calendar.statusLegend')}>
              <span><i className="status-approved" />{t('common.approved')}</span>
              <span><i className="status-submitted" />{t('common.submitted')}</span>
              <span><i className="status-draft" />{t('common.draft')}</span>
              <span><i className="status-rejected" />{t('common.rejected')}</span>
              <span><i className="status-overtime" />{t('common.overtime')}</span>
            </div>
          </section>

          <section className="workCalendarDayPanel">
            <div className="workCalendarDayPanel-heading">
              <div>
                <span>{formatLongDate(selectedDateKey, locale)}</span>
                <h2>{formatHours(selectedHours)}</h2>
                {selectedOvertime > 0 ? <p>+{formatHours(selectedOvertime)} {t('calendar.overtimeSuffix')}</p> : null}
              </div>
              {selectedStatus ? <span className={`workCalendarStatus status-${selectedStatus.toLowerCase()}`}>{statusLabel(selectedStatus)}</span> : null}
            </div>

            <div className="workCalendarEntries">
              {selectedEntries.length ? selectedEntries.map(entry => (
                <article className="workCalendarEntry" key={entry.id}>
                  <span className={`workCalendarEntry-dot status-${entry.status.toLowerCase()}`} />
                  <div>
                    <strong>{entry.project?.name || t('calendar.workEntry')}</strong>
                    <small>{statusLabel(entry.status)}</small>
                  </div>
                  <b>{formatHours(entry.hours)}</b>
                </article>
              )) : <p className="workCalendarEmpty">{t('calendar.noHours')}</p>}
            </div>

            <div className="workCalendarDayActions">
              <Link className="workCalendarPrimaryAction" to={selectedHoursHref}>{t('calendar.addEntry')}</Link>
              <Link className="workCalendarSecondaryAction" to={selectedHoursHref}>{t('calendar.openHours')}</Link>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
