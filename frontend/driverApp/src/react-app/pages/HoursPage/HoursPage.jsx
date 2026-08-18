import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  useCreateWorkEntryMutation,
  useDeleteWorkEntryMutation,
  useGetProjectsQuery,
  useGetWeekEntriesQuery,
  useSubmitWeekMutation,
  useUpdateWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './HoursPage.css';

const LOCKED_STATUSES = new Set(['SUBMITTED', 'APPROVED']);
const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
}

function parseDateKey(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function shiftWeek(weekStart, amount) {
  const date = parseDateKey(weekStart);
  return new Date(date.getTime() + amount * 7 * DAY_MS).toISOString().slice(0, 10);
}

function getWeekStartForDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '';
  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getTime() + mondayOffset * DAY_MS).toISOString().slice(0, 10);
}

function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return toDateKey(monday);
}

function getInitialWeekStart(currentWeekStart) {
  const selectedDate = new URLSearchParams(window.location.search).get('date');
  return getWeekStartForDate(selectedDate) || currentWeekStart;
}

function formatDate(value) {
  if (!value) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(parseDateKey(value));
}

function formatPeriod(week) {
  if (!week?.weekStart || !week?.weekEnd) return 'Selected week';
  return `${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)} CZK`;
}

function getEntriesByDate(entries) {
  return entries.reduce((map, entry) => {
    const dayEntries = map.get(entry.workDate) || [];
    dayEntries.push(entry);
    map.set(entry.workDate, dayEntries);
    return map;
  }, new Map());
}

function getStatusLabel(status) {
  return status ? status.toLowerCase() : 'draft';
}

export function HoursPage() {
  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);
  const [weekStart, setWeekStart] = useState(() => getInitialWeekStart(currentWeekStart));
  const { data, error, isFetching, isLoading } = useGetWeekEntriesQuery({ weekStart });
  const projectsQuery = useGetProjectsQuery();
  const [createWorkEntry, createState] = useCreateWorkEntryMutation();
  const [updateWorkEntry, updateState] = useUpdateWorkEntryMutation();
  const [deleteWorkEntry, deleteState] = useDeleteWorkEntryMutation();
  const [submitWeek, submitState] = useSubmitWeekMutation();
  const [entryDrafts, setEntryDrafts] = useState({});
  const [newDrafts, setNewDrafts] = useState({});
  const [actionError, setActionError] = useState('');

  const week = data?.week || null;
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const projects = Array.isArray(projectsQuery.data?.projects)
    ? projectsQuery.data.projects.filter(project => project.isActive)
    : [];
  const defaultProjectId = projects[0]?.id || '';
  const entriesByDate = useMemo(() => getEntriesByDate(entries), [entries]);
  const summary = data?.summary || {};
  const submission = data?.submission || null;
  const submissionStatus = submission?.status || 'DRAFT';
  const isSubmittedOrApproved = LOCKED_STATUSES.has(submissionStatus);
  const isCurrentWeek = weekStart === currentWeekStart;
  const canGoForward = weekStart < currentWeekStart;
  const isMutating =
    createState.isLoading ||
    updateState.isLoading ||
    deleteState.isLoading ||
    submitState.isLoading;

  useEffect(() => {
    setEntryDrafts(
      entries.reduce((next, entry) => {
        next[entry.id] = {
          hours: entry.hours || '',
          projectId: entry.projectId || defaultProjectId,
        };
        return next;
      }, {})
    );
  }, [defaultProjectId, entries]);

  useEffect(() => {
    if (!week?.days) return;

    setNewDrafts(current =>
      week.days.reduce((next, day) => {
        next[day.date] = current[day.date] || {
          hours: '',
          projectId: defaultProjectId,
        };

        if (!next[day.date].projectId && defaultProjectId) {
          next[day.date] = {
            ...next[day.date],
            projectId: defaultProjectId,
          };
        }

        return next;
      }, {})
    );
  }, [defaultProjectId, week]);

  function changeWeek(nextWeekStart) {
    setActionError('');
    setEntryDrafts({});
    setNewDrafts({});
    setWeekStart(nextWeekStart);
  }

  function updateEntryDraft(entryId, field, value) {
    setEntryDrafts(current => ({
      ...current,
      [entryId]: {
        ...(current[entryId] || {}),
        [field]: value,
      },
    }));
  }

  function updateNewDraft(date, field, value) {
    setNewDrafts(current => ({
      ...current,
      [date]: {
        ...(current[date] || {}),
        [field]: value,
      },
    }));
  }

  async function saveEntry(entry) {
    setActionError('');
    const draft = entryDrafts[entry.id] || {};
    const payload = {
      entryId: entry.id,
      hours: draft.hours,
    };

    if (draft.projectId && draft.projectId !== entry.projectId) {
      payload.projectId = draft.projectId;
    }

    try {
      await updateWorkEntry(payload).unwrap();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function addEntry(day) {
    setActionError('');
    const draft = newDrafts[day.date] || {};

    try {
      await createWorkEntry({
        workDate: day.date,
        hours: draft.hours,
        projectId: draft.projectId,
      }).unwrap();
      updateNewDraft(day.date, 'hours', '');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function deleteEntry(entry) {
    setActionError('');

    try {
      await deleteWorkEntry(entry.id).unwrap();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function submitSelectedWeek() {
    setActionError('');

    try {
      await submitWeek({ weekStart }).unwrap();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="hoursPage pageStack">
      <header className="hoursHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Work entries</p>
          <h1>Hours</h1>
          <p>{summary.totalHours || '0.00'} hours in selected week</p>
        </div>

        <div className={`hoursStatusBadge hoursStatusBadge--${submissionStatus.toLowerCase()}`}>
          {getStatusLabel(submissionStatus)}
        </div>
      </header>

      <section className="hoursWeekNavigator screenCard" aria-label="Week history navigation">
        <button
          type="button"
          disabled={isFetching || isMutating}
          onClick={() => changeWeek(shiftWeek(weekStart, -1))}
        >
          ← Previous
        </button>

        <div className="hoursWeekNavigator-current">
          <span>{isCurrentWeek ? 'Current week' : 'Week history'}</span>
          <strong>{formatPeriod(week)}</strong>
        </div>

        <div className="hoursWeekNavigator-actions">
          {!isCurrentWeek ? (
            <button
              type="button"
              disabled={isFetching || isMutating}
              onClick={() => changeWeek(currentWeekStart)}
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canGoForward || isFetching || isMutating}
            onClick={() => changeWeek(shiftWeek(weekStart, 1))}
          >
            Next →
          </button>
        </div>
      </section>

      {submissionStatus === 'REJECTED' && submission?.rejectionReason ? (
        <section className="hoursRejectionNotice" role="status">
          <strong>Manager requested changes</strong>
          <p>{submission.rejectionReason}</p>
        </section>
      ) : null}

      <section className="hoursSummaryGrid" aria-label="Selected week salary summary">
        <article className="hoursSummaryCard">
          <span>Total hours</span>
          <strong>{summary.totalHours || '0.00'}</strong>
        </article>
        <article className="hoursSummaryCard">
          <span>Approved hours</span>
          <strong>{summary.approvedHours || '0.00'}</strong>
        </article>
        <article className="hoursSummaryCard">
          <span>Confirmed salary</span>
          <strong>{formatMoney(summary.confirmedSalaryCzk)}</strong>
        </article>
        <article className="hoursSummaryCard">
          <span>Predicted salary</span>
          <strong>{formatMoney(summary.predictedSalaryCzk)}</strong>
        </article>
      </section>

      <section className="hoursWeek screenCard">
        <div className="compactHeader">
          <h2>{formatPeriod(week)}</h2>
          <p>
            {summary.pendingHours || '0.00'} pending · {summary.approvedHours || '0.00'} approved
          </p>
        </div>

        {isLoading || projectsQuery.isLoading ? (
          <RequestLoadingState label="Loading hours" />
        ) : (
          <div className="hoursWeekGrid" aria-label="Selected week hours">
            {(week?.days || []).map(day => {
              const dayEntries = entriesByDate.get(day.date) || [];
              const newDraft = newDrafts[day.date] || {};
              const canAdd =
                !isSubmittedOrApproved &&
                !isMutating &&
                projects.length > 0 &&
                newDraft.hours &&
                newDraft.projectId;

              return (
                <article className="hoursDay" key={day.date}>
                  <div className="hoursDay-top">
                    <span>{day.label}</span>
                    <strong>{day.date.slice(5)}</strong>
                  </div>

                  <div className="hoursEntries">
                    {dayEntries.map(entry => {
                      const isLocked =
                        isSubmittedOrApproved || LOCKED_STATUSES.has(entry.status);
                      const draft = entryDrafts[entry.id] || {};

                      return (
                        <div className="hoursEntryRow" key={entry.id}>
                          <select
                            value={draft.projectId || ''}
                            disabled={isLocked || isMutating}
                            onChange={event =>
                              updateEntryDraft(entry.id, 'projectId', event.target.value)
                            }
                          >
                            {entry.project && !projects.some(project => project.id === entry.project.id) ? (
                              <option value={entry.project.id}>{entry.project.name} (inactive)</option>
                            ) : null}
                            {projects.map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>

                          <input
                            inputMode="decimal"
                            min="0"
                            max="24"
                            step="0.25"
                            type="number"
                            value={draft.hours || ''}
                            disabled={isLocked || isMutating}
                            placeholder="0"
                            onChange={event =>
                              updateEntryDraft(entry.id, 'hours', event.target.value)
                            }
                          />

                          <span className={`hoursDay-status hoursDay-status--${getStatusLabel(entry.status)}`}>
                            {getStatusLabel(entry.status)}
                          </span>

                          <div className="hoursDay-actions">
                            <button
                              type="button"
                              disabled={isLocked || isMutating || !draft.hours || !draft.projectId}
                              onClick={() => saveEntry(entry)}
                            >
                              Save
                            </button>
                            <button
                              className="hoursDay-delete"
                              type="button"
                              disabled={isLocked || isMutating}
                              aria-label={`Delete ${day.date}`}
                              onClick={() => deleteEntry(entry)}
                            >
                              <SvgIcon name="trash" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hoursEntryRow hoursEntryRow--new">
                    <select
                      value={newDraft.projectId || ''}
                      disabled={isSubmittedOrApproved || isMutating || !projects.length}
                      onChange={event => updateNewDraft(day.date, 'projectId', event.target.value)}
                    >
                      {!projects.length ? <option value="">No active projects</option> : null}
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>

                    <input
                      inputMode="decimal"
                      min="0"
                      max="24"
                      step="0.25"
                      type="number"
                      value={newDraft.hours || ''}
                      disabled={isSubmittedOrApproved || isMutating || !projects.length}
                      placeholder="0"
                      onChange={event => updateNewDraft(day.date, 'hours', event.target.value)}
                    />

                    <button type="button" disabled={!canAdd} onClick={() => addEntry(day)}>
                      Add
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
        {projectsQuery.error ? (
          <p className="statusNote is-error">{getApiErrorMessage(projectsQuery.error)}</p>
        ) : null}
        {actionError ? <p className="statusNote is-error">{actionError}</p> : null}
      </section>

      <section className="hoursSubmitPanel">
        <div>
          <strong>{submission ? getStatusLabel(submission.status) : 'draft'}</strong>
          <p>
            {isCurrentWeek
              ? 'Send the completed week to your company manager.'
              : 'Review, edit, or resubmit this historical week when it is not locked.'}
          </p>
        </div>

        <button
          className="hoursSubmitButton"
          type="button"
          disabled={isFetching || isMutating || isSubmittedOrApproved || !entries.length}
          onClick={submitSelectedWeek}
        >
          <SvgIcon name="send" />
          {submissionStatus === 'REJECTED' ? 'Resubmit week' : 'Send week'}
        </button>
      </section>
    </section>
  );
}
