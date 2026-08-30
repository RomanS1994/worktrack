import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetManagerTimesheetQuery } from '../../features/worktrack/managerTimesheetApi.js';
import {
  useApproveSubmissionMutation,
  useClearManagerSubmissionMutation,
  useDeleteManagerWorkEntryMutation,
  useGetManagerSubmissionQuery,
  useGetManagerSubmissionsQuery,
  useGetProjectsQuery,
  useRejectSubmissionMutation,
  useUpdateManagerWorkEntryMutation,
} from '../../features/worktrack/worktrackApi.js';
import './ApprovalsPage.css';

const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };
const PROBLEM_STATUSES = new Set(['MISMATCH', 'MISSING_MANAGER', 'MISSING_EMPLOYEE']);
const COPY = {
  uk: {
    back: 'Назад до списку',
    workEntries: 'Робочі записи',
    totalHours: 'Всього годин',
    comparisonLoading: 'Звіряємо записи з табелем…',
    comparisonFailed: 'Не вдалося звірити записи з табелем.',
    mismatchHint: 'Перевірте записи перед погодженням',
    mismatchWithTimesheet: 'Невідповідність із табелем',
    editEntry: 'Редагувати запис',
    viewMismatch: 'Переглянути невідповідність',
    deleteEntry: 'Видалити запис',
    deleteConfirm: 'Видалити цей запис працівника? Цю дію не можна скасувати.',
    clearWeek: 'Очистити тиждень',
    clearConfirm: 'Очистити весь цей тиждень працівника? Усі записи та відправка на погодження будуть видалені.',
    deleted: 'Запис видалено.',
    cleared: 'Тиждень очищено.',
    saved: 'Зміни збережено.',
    approved: 'Тиждень погоджено.',
    rejected: 'Тиждень повернено працівнику.',
    reject: 'Відхилити',
    approve: hours => `Погодити ${hours}`,
    mismatchTitle: 'Невідповідність із табелем',
    approvalEntry: 'Запис у погодженні',
    timesheetEntry: 'У табелі',
    difference: 'Різниця',
    mismatchReason: 'Причина невідповідності',
    whatToDo: 'Що зробити?',
    whatToDoText: 'Відредагуйте запис або змініть кількість годин у табелі, якщо це потрібно.',
    close: 'Закрити',
    openTimesheet: 'Відкрити табель',
    hoursDiffer: 'Не збігається кількість годин',
    breakDiffers: 'Не збігається тривалість обіду',
    projectDiffers: 'Не збігається об’єкт',
    missingManager: 'У табелі немає запису за цей день',
    missingEmployee: 'У погодженні немає запису за цей день',
    moreInApproval: 'більше у погодженні',
    moreInTimesheet: 'більше у табелі',
    editTitle: 'Редагувати робочий запис',
    project: 'Об’єкт',
    from: 'Від',
    to: 'До',
    hours: 'Години',
    netHours: 'Після обіду',
    note: 'Нотатка',
    notePlaceholder: 'Наприклад: монтаж, сервіс, додаткові роботи…',
    save: 'Зберегти зміни',
    saving: 'Збереження…',
    noProjects: 'Немає активних об’єктів',
    invalidTime: 'Перевірте час початку та завершення.',
    invalidHours: 'Вкажіть кількість годин від 0.01 до 24.',
    rejectTitle: 'Відхилити тиждень?',
    rejectText: 'Напишіть працівнику, що саме потрібно виправити перед повторним поданням.',
    rejectionReason: 'Причина відхилення',
    rejectionPlaceholder: 'Наприклад: виправте години за четвер і надішліть тиждень повторно.',
    confirmReject: 'Відхилити й надіслати',
    managerOnlyProject: 'Немає запису у погодженні',
    minutes: 'хв',
    weekActions: 'Дії з тижнем',
    entryActions: 'Дії із записом',
    processing: 'Зачекайте…',
  },
  cs: {
    back: 'Zpět na seznam', workEntries: 'Pracovní záznamy', totalHours: 'Celkem hodin', comparisonLoading: 'Porovnáváme záznamy s výkazem…', comparisonFailed: 'Záznamy se nepodařilo porovnat s výkazem.', mismatchHint: 'Před schválením zkontrolujte záznamy', mismatchWithTimesheet: 'Nesrovnalost s výkazem', editEntry: 'Upravit záznam', viewMismatch: 'Zobrazit nesrovnalost', deleteEntry: 'Smazat záznam', deleteConfirm: 'Smazat tento záznam zaměstnance? Tuto akci nelze vrátit zpět.', clearWeek: 'Vymazat týden', clearConfirm: 'Vymazat celý týden zaměstnance? Všechny záznamy a odeslání ke schválení budou odstraněny.', deleted: 'Záznam byl smazán.', cleared: 'Týden byl vymazán.', saved: 'Změny byly uloženy.', approved: 'Týden byl schválen.', rejected: 'Týden byl vrácen zaměstnanci.', reject: 'Zamítnout', approve: hours => `Schválit ${hours}`, mismatchTitle: 'Nesrovnalost s výkazem', approvalEntry: 'Záznam ke schválení', timesheetEntry: 'Ve výkazu', difference: 'Rozdíl', mismatchReason: 'Důvod nesrovnalosti', whatToDo: 'Co udělat?', whatToDoText: 'Upravte záznam nebo podle potřeby změňte počet hodin ve výkazu.', close: 'Zavřít', openTimesheet: 'Otevřít výkaz', hoursDiffer: 'Počet hodin se neshoduje', breakDiffers: 'Délka přestávky se neshoduje', projectDiffers: 'Objekt se neshoduje', missingManager: 'Ve výkazu pro tento den není záznam', missingEmployee: 'Ke schválení pro tento den není záznam', moreInApproval: 'více ke schválení', moreInTimesheet: 'více ve výkazu', editTitle: 'Upravit pracovní záznam', project: 'Objekt', from: 'Od', to: 'Do', hours: 'Hodiny', netHours: 'Po přestávce', note: 'Poznámka', notePlaceholder: 'Např. montáž, servis, vícepráce…', save: 'Uložit změny', saving: 'Ukládání…', noProjects: 'Žádné aktivní objekty', invalidTime: 'Zkontrolujte čas začátku a konce.', invalidHours: 'Zadejte počet hodin od 0.01 do 24.', rejectTitle: 'Zamítnout týden?', rejectText: 'Napište zaměstnanci, co má před dalším odesláním opravit.', rejectionReason: 'Důvod zamítnutí', rejectionPlaceholder: 'Např. opravte čtvrteční hodiny a odešlete týden znovu.', confirmReject: 'Zamítnout a odeslat', managerOnlyProject: 'Chybí záznam ke schválení', minutes: 'min', weekActions: 'Akce s týdnem', entryActions: 'Akce se záznamem', processing: 'Čekejte…',
  },
  en: {
    back: 'Back to list', workEntries: 'Work entries', totalHours: 'Total hours', comparisonLoading: 'Comparing entries with the timesheet…', comparisonFailed: 'The entries could not be compared with the timesheet.', mismatchHint: 'Check the entries before approval', mismatchWithTimesheet: 'Timesheet mismatch', editEntry: 'Edit entry', viewMismatch: 'Review mismatch', deleteEntry: 'Delete entry', deleteConfirm: 'Delete this employee entry? This action cannot be undone.', clearWeek: 'Clear week', clearConfirm: 'Clear this employee week? All entries and the submitted week will be deleted.', deleted: 'Entry deleted.', cleared: 'Week cleared.', saved: 'Changes saved.', approved: 'Week approved.', rejected: 'Week returned to the employee.', reject: 'Reject', approve: hours => `Approve ${hours}`, mismatchTitle: 'Timesheet mismatch', approvalEntry: 'Approval entry', timesheetEntry: 'In timesheet', difference: 'Difference', mismatchReason: 'Reason for mismatch', whatToDo: 'What should I do?', whatToDoText: 'Edit the entry or change the hours in the timesheet if needed.', close: 'Close', openTimesheet: 'Open timesheet', hoursDiffer: 'The number of hours does not match', breakDiffers: 'The lunch break does not match', projectDiffers: 'The project does not match', missingManager: 'There is no timesheet entry for this day', missingEmployee: 'There is no approval entry for this day', moreInApproval: 'more in approval', moreInTimesheet: 'more in timesheet', editTitle: 'Edit work entry', project: 'Project / site', from: 'From', to: 'To', hours: 'Hours', netHours: 'After lunch', note: 'Note', notePlaceholder: 'For example: installation, service, extra work…', save: 'Save changes', saving: 'Saving…', noProjects: 'No active projects', invalidTime: 'Check the start and end time.', invalidHours: 'Enter hours between 0.01 and 24.', rejectTitle: 'Reject this week?', rejectText: 'Tell the employee what needs to be corrected before resubmitting.', rejectionReason: 'Reason for rejection', rejectionPlaceholder: "For example: correct Thursday's hours and resubmit the week.", confirmReject: 'Reject and send', managerOnlyProject: 'Missing approval entry', minutes: 'min', weekActions: 'Week actions', entryActions: 'Entry actions', processing: 'Please wait…',
  },
};

function getEmployeeName(submission, fallback) {
  const employee = submission?.employee;
  return employee?.name || employee?.email || fallback;
}

function parseDate(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function cleanFormattedDate(value, locale) {
  return value.replace(/\s+р\.$/u, '').replace(/\s+/g, ' ').trim();
}

function formatPeriod(submission, locale) {
  const start = parseDate(submission?.weekStart);
  const end = parseDate(submission?.weekEnd);
  if (!start || !end) return '—';

  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    const endParts = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(end);
    const month = endParts.find(part => part.type === 'month')?.value || '';
    const year = endParts.find(part => part.type === 'year')?.value || '';
    return `${start.getUTCDate()} – ${end.getUTCDate()} ${month} ${year}`.trim();
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${cleanFormattedDate(formatter.format(start), locale)} – ${cleanFormattedDate(formatter.format(end), locale)}`;
}

function formatLongDate(value, locale) {
  const date = parseDate(value);
  if (!date) return '';
  const formatted = cleanFormattedDate(new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date), locale);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatEntryDate(value, locale) {
  const date = parseDate(value);
  if (!date) return { weekday: '', day: '' };
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .replaceAll('.', '');
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day: String(date.getUTCDate()),
  };
}

function formatHours(value) {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} h` : '—';
}

function formatSignedHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)} h`;
}

function sortEntries(entries = []) {
  return [...entries].sort((first, second) => {
    const dateComparison = String(first.workDate).localeCompare(String(second.workDate));
    if (dateComparison) return dateComparison;
    return String(first.startTime || '').localeCompare(String(second.startTime || ''));
  });
}

function mismatchCountLabel(count, language) {
  if (language === 'en') return `${count} ${count === 1 ? 'entry has' : 'entries have'} a mismatch`;
  if (language === 'cs') return count === 1 ? 'Nesrovnalost v 1 záznamu' : `Nesrovnalosti v ${count} záznamech`;
  return count === 1 ? 'Є невідповідності у 1 записі' : `Є невідповідності у ${count} записах`;
}

function getMismatchReason(day, copy) {
  if (!day) return '';
  if (day.status === 'MISSING_MANAGER') return copy.missingManager;
  if (day.status === 'MISSING_EMPLOYEE') return copy.missingEmployee;

  const reasons = [];
  if (day.reasons?.includes('hours')) {
    const difference = Number(day.employeeHours || 0) - Number(day.managerHours || 0);
    const side = difference >= 0 ? copy.moreInApproval : copy.moreInTimesheet;
    reasons.push(`${copy.hoursDiffer} (${formatSignedHours(Math.abs(difference))} ${side})`);
  }
  if (day.reasons?.includes('break')) {
    reasons.push(`${copy.breakDiffers} (${day.employeeBreakMinutes ?? 0} / ${day.managerBreakMinutes ?? 0} ${copy.minutes})`);
  }
  if (day.reasons?.includes('project')) reasons.push(copy.projectDiffers);
  return reasons.join(' · ');
}

function calculateShiftHours(startTime, endTime, breakMinutes) {
  if (!/^\d{2}:\d{2}$/.test(startTime || '') || !/^\d{2}:\d{2}$/.test(endTime || '')) return null;
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  const grossMinutes = end - start;
  if (grossMinutes <= 0 || grossMinutes > 1440) return null;
  const lunch = grossMinutes > breakMinutes ? breakMinutes : 0;
  return Math.max(0, (grossMinutes - lunch) / 60);
}

function ModalBackdrop({ children, className = '', onClose }) {
  return <div className={`approvalModalBackdrop ${className}`} onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>{children}</div>;
}

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const copy = COPY[language] || COPY.uk;
  const employeeFallback = t('approvals.employeeFallback');
  const { data, error, isLoading } = useGetManagerSubmissionsQuery({ status: 'SUBMITTED' });
  const rawSubmissions = useMemo(() => (Array.isArray(data?.submissions) ? data.submissions : []), [data]);
  const [hiddenSubmissionIds, setHiddenSubmissionIds] = useState([]);
  const submissions = useMemo(
    () => rawSubmissions.filter(submission => !hiddenSubmissionIds.includes(submission.id)),
    [hiddenSubmissionIds, rawSubmissions],
  );
  const [selectedId, setSelectedId] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionEntryId, setActionEntryId] = useState('');
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [mismatchDate, setMismatchDate] = useState('');
  const [editorDraft, setEditorDraft] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const selectedFromList = submissions.find(submission => submission.id === selectedId);
  const detailQuery = useGetManagerSubmissionQuery(selectedId, { skip: !selectedId || Boolean(error) });
  const detail = detailQuery.data?.submission || selectedFromList || null;
  const projectsQuery = useGetProjectsQuery();
  const projects = useMemo(
    () => (projectsQuery.data?.projects || []).filter(project => project.isActive),
    [projectsQuery.data],
  );
  const startMonth = detail?.weekStart?.slice(0, 7) || '';
  const endMonth = detail?.weekEnd?.slice(0, 7) || '';
  const startTimesheetQuery = useGetManagerTimesheetQuery(startMonth, { skip: !startMonth });
  const endTimesheetQuery = useGetManagerTimesheetQuery(endMonth, {
    skip: !endMonth || endMonth === startMonth,
  });
  const [approveSubmission, approveState] = useApproveSubmissionMutation();
  const [rejectSubmission, rejectState] = useRejectSubmissionMutation();
  const [updateManagerEntry, updateState] = useUpdateManagerWorkEntryMutation();
  const [deleteManagerEntry, deleteState] = useDeleteManagerWorkEntryMutation();
  const [clearManagerSubmission, clearState] = useClearManagerSubmissionMutation();
  const isReviewing = approveState.isLoading || rejectState.isLoading || updateState.isLoading || deleteState.isLoading || clearState.isLoading;
  const trimmedRejectionReason = rejectionReason.trim();
  const pendingHours = submissions.reduce((total, submission) => total + Number(submission.summary?.totalHours || 0), 0);
  const hasQueue = !isLoading && !error;

  const timesheetPayloads = useMemo(() => {
    const payloads = [];
    if (startTimesheetQuery.data) payloads.push(startTimesheetQuery.data);
    if (endMonth !== startMonth && endTimesheetQuery.data) payloads.push(endTimesheetQuery.data);
    return payloads;
  }, [endMonth, endTimesheetQuery.data, startMonth, startTimesheetQuery.data]);
  const timesheetReady = Boolean(
    detail &&
    startTimesheetQuery.data &&
    (endMonth === startMonth || endTimesheetQuery.data),
  );
  const timesheetLoading = Boolean(detail) && (
    startTimesheetQuery.isLoading ||
    (endMonth !== startMonth && endTimesheetQuery.isLoading)
  );
  const timesheetError = startTimesheetQuery.error || (endMonth !== startMonth ? endTimesheetQuery.error : null);
  const timesheetDays = useMemo(() => {
    if (!detail) return [];
    return timesheetPayloads.flatMap(payload => {
      const row = (payload.rows || []).find(item => item.employeeId === detail.employeeMembershipId);
      return row?.days || [];
    });
  }, [detail, timesheetPayloads]);
  const timesheetDayMap = useMemo(
    () => new Map(timesheetDays.map(day => [day.date, day])),
    [timesheetDays],
  );
  const mismatchDays = useMemo(() => {
    if (!detail || !timesheetReady) return [];
    return timesheetDays.filter(day => (
      day.date >= detail.weekStart &&
      day.date <= detail.weekEnd &&
      PROBLEM_STATUSES.has(day.status)
    ));
  }, [detail, timesheetDays, timesheetReady]);
  const entriesByDate = useMemo(() => {
    const map = new Map();
    sortEntries(detail?.entries || []).forEach(entry => {
      const current = map.get(entry.workDate) || [];
      current.push(entry);
      map.set(entry.workDate, current);
    });
    return map;
  }, [detail?.entries]);
  const entryRows = useMemo(() => {
    if (!detail) return [];
    const dates = new Set(entriesByDate.keys());
    mismatchDays.forEach(day => {
      if (day.status === 'MISSING_EMPLOYEE') dates.add(day.date);
    });

    return [...dates].sort().flatMap(date => {
      const entries = entriesByDate.get(date) || [];
      const comparison = timesheetDayMap.get(date) || null;
      if (!entries.length) {
        return [{
          key: `manager-only:${date}`,
          date,
          entry: null,
          comparison,
          isFirstForDate: true,
        }];
      }
      return entries.map((entry, index) => ({
        key: entry.id,
        date,
        entry,
        comparison,
        isFirstForDate: index === 0,
      }));
    });
  }, [detail, entriesByDate, mismatchDays, timesheetDayMap]);
  const activeActionRow = entryRows.find(row => row.key === actionEntryId) || null;
  const activeMismatch = mismatchDate ? timesheetDayMap.get(mismatchDate) || null : null;
  const activeMismatchEntries = mismatchDate ? entriesByDate.get(mismatchDate) || [] : [];
  const breakMinutes = Number(detail?.workRules?.breakMinutes || 0);
  const editorNetHours = editorDraft?.usesTimes
    ? calculateShiftHours(editorDraft.startTime, editorDraft.endTime, breakMinutes)
    : Number(editorDraft?.hours || 0);
  const overlayOpen = Boolean(actionEntryId || weekMenuOpen || mismatchDate || editorDraft || rejectOpen);

  useEffect(() => {
    setHiddenSubmissionIds(current => current.filter(id => rawSubmissions.some(submission => submission.id === id)));
  }, [rawSubmissions]);

  useEffect(() => {
    if (!selectedId && submissions[0]?.id) {
      setSelectedId(submissions[0].id);
      return;
    }
    if (selectedId && !submissions.some(submission => submission.id === selectedId)) {
      setSelectedId(submissions[0]?.id || '');
      setMobileDetailOpen(false);
    }
  }, [selectedId, submissions]);

  useEffect(() => {
    setActionError('');
    setRejectionReason('');
    setActionEntryId('');
    setWeekMenuOpen(false);
    setMismatchDate('');
    setEditorDraft(null);
    setRejectOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!overlayOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      setActionEntryId('');
      setWeekMenuOpen(false);
      setMismatchDate('');
      setEditorDraft(null);
      setRejectOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [overlayOpen]);

  function hideReviewedSubmission(id) {
    setHiddenSubmissionIds(current => current.includes(id) ? current : [...current, id]);
    setSelectedId('');
    setMobileDetailOpen(false);
  }

  function openSubmission(id) {
    setActionMessage('');
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  function closeDetail() {
    setMobileDetailOpen(false);
    setActionEntryId('');
    setWeekMenuOpen(false);
    setMismatchDate('');
    setEditorDraft(null);
    setRejectOpen(false);
  }

  function openEditor(entry) {
    if (!entry) return;
    setActionError('');
    setActionEntryId('');
    setMismatchDate('');
    setEditorDraft({
      id: entry.id,
      workDate: entry.workDate,
      projectId: entry.projectId || entry.project?.id || '',
      startTime: entry.startTime || '07:00',
      endTime: entry.endTime || '15:30',
      hours: String(entry.hours || ''),
      note: entry.note || '',
      usesTimes: Boolean(entry.startTime && entry.endTime),
      currentProject: entry.project || null,
    });
  }

  async function review(decision) {
    if (!hasQueue || !detail?.id || isReviewing) return;
    setActionError('');
    setActionMessage('');
    if (decision === 'reject' && !trimmedRejectionReason) {
      setActionError(t('approvals.reasonRequired'));
      return;
    }
    try {
      if (decision === 'approve') await approveSubmission(detail.id).unwrap();
      else await rejectSubmission({ submissionId: detail.id, rejectionReason: trimmedRejectionReason }).unwrap();
      const reviewedId = detail.id;
      setActionMessage(decision === 'approve' ? copy.approved : copy.rejected);
      setRejectionReason('');
      setRejectOpen(false);
      hideReviewedSubmission(reviewedId);
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function saveEntry(event) {
    event.preventDefault();
    if (!editorDraft || isReviewing) return;
    setActionError('');
    setActionMessage('');
    if (!editorDraft.projectId) {
      setActionError(copy.noProjects);
      return;
    }
    if (editorDraft.usesTimes && editorNetHours == null) {
      setActionError(copy.invalidTime);
      return;
    }
    if (!editorDraft.usesTimes && (!Number.isFinite(editorNetHours) || editorNetHours <= 0 || editorNetHours > 24)) {
      setActionError(copy.invalidHours);
      return;
    }

    const payload = {
      entryId: editorDraft.id,
      projectId: editorDraft.projectId,
      note: editorDraft.note,
      ...(editorDraft.usesTimes
        ? { startTime: editorDraft.startTime, endTime: editorDraft.endTime }
        : { hours: editorDraft.hours }),
    };
    try {
      await updateManagerEntry(payload).unwrap();
      setEditorDraft(null);
      setActionMessage(copy.saved);
      await detailQuery.refetch();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function removeEntry(entryId) {
    if (isReviewing || !window.confirm(copy.deleteConfirm)) return;
    setActionError('');
    setActionMessage('');
    setActionEntryId('');
    try {
      const result = await deleteManagerEntry(entryId).unwrap();
      setActionMessage(copy.deleted);
      if (result?.submissionDeleted && detail?.id) hideReviewedSubmission(detail.id);
      else await detailQuery.refetch();
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function clearWeek() {
    if (!detail?.id || isReviewing || !window.confirm(copy.clearConfirm)) return;
    setActionError('');
    setActionMessage('');
    setWeekMenuOpen(false);
    try {
      await clearManagerSubmission(detail.id).unwrap();
      const clearedId = detail.id;
      setActionMessage(copy.cleared);
      hideReviewedSubmission(clearedId);
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return <section className={`approvalsPage pageStack${mobileDetailOpen ? ' is-detail-open' : ''}`}>
    <header className="approvalsHeader">
      <div>
        <p className="sectionEyebrow">{t('approvals.eyebrow')}</p>
        <h1>{t('approvals.title')}</h1>
        <p>{t('approvals.intro')}</p>
      </div>
      {hasQueue ? <div className="approvalsHeaderStats" aria-label={t('approvals.pendingSummary')}>
        <div><strong>{submissions.length}</strong><span>{t('approvals.pendingWeeks')}</span></div>
        <div><strong>{formatHours(pendingHours)}</strong><span>{t('approvals.hoursWaiting')}</span></div>
      </div> : null}
    </header>

    {isLoading ? <RequestLoadingState label={t('approvals.loading')} /> : null}
    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
    {actionMessage ? <p className="statusNote is-success approvalsPageMessage">{actionMessage}</p> : null}
    {hasQueue && !submissions.length ? <section className="approvalsEmpty screenCard">
      <span aria-hidden="true"><SvgIcon name="check-circle" /></span>
      <div><h2>{t('approvals.allCaughtUp')}</h2><p>{t('approvals.noPending')}</p></div>
    </section> : null}

    {hasQueue && submissions.length ? <section className={`approvalsWorkspace${mobileDetailOpen ? ' is-mobile-detail' : ''}`}>
      <aside className="approvalsQueue">
        <div className="approvalsQueueHeader">
          <div><span>{t('approvals.pending')}</span><strong>{submissions.length}</strong></div>
          <p>{t('approvals.selectWeek')}</p>
        </div>
        <div className="approvalsList" aria-label={t('approvals.pendingSubmissions')}>
          {submissions.map(submission => <button
            className={`approvalItem ${selectedId === submission.id ? 'is-active' : ''}`}
            type="button"
            key={submission.id}
            onClick={() => openSubmission(submission.id)}
          >
            <span className="approvalAvatar" aria-hidden="true">{getEmployeeName(submission, employeeFallback).slice(0, 1).toUpperCase()}</span>
            <span className="approvalItemCopy"><strong>{getEmployeeName(submission, employeeFallback)}</strong><em>{formatPeriod(submission, locale)}</em></span>
            <span className="approvalItemMeta"><b>{formatHours(submission.summary?.totalHours)}</b><i>{t('approvals.submittedStatus')}</i></span>
            <span className="approvalItemChevron" aria-hidden="true">›</span>
          </button>)}
        </div>
      </aside>

      <article className="approvalDetail">
        <button className="approvalMobileBack" type="button" aria-label={copy.back} onClick={closeDetail}>
          <SvgIcon name="back" />
        </button>
        {detailQuery.isLoading ? <RequestLoadingState label={t('approvals.loadingDetails')} /> : null}
        {detailQuery.error ? <p className="statusNote is-error">{getApiErrorMessage(detailQuery.error)}</p> : null}
        {detail && !detailQuery.error ? <>
          <section className="approvalWeekSummary">
            <span className="approvalWeekIcon" aria-hidden="true"><SvgIcon name="calendar" /></span>
            <div className="approvalWeekIdentity">
              <strong>{formatPeriod(detail, locale)}</strong>
              <span>{getEmployeeName(detail, employeeFallback)}</span>
            </div>
            <div className="approvalWeekTotal">
              <strong>{formatHours(detail.summary?.totalHours)}</strong>
              <span>{copy.totalHours}</span>
            </div>
          </section>

          <section className="approvalEntriesCard">
            <header className="approvalEntriesHeader">
              <h2>{copy.workEntries}</h2>
              <button type="button" aria-label={copy.weekActions} aria-expanded={weekMenuOpen} onClick={() => setWeekMenuOpen(true)}>•••</button>
            </header>

            {timesheetLoading ? <p className="approvalComparisonState">{copy.comparisonLoading}</p> : null}
            {timesheetError ? <p className="approvalComparisonState is-error">{copy.comparisonFailed}</p> : null}
            {mismatchDays.length ? <button className="approvalMismatchBanner" type="button" onClick={() => setMismatchDate(mismatchDays[0].date)}>
              <span className="approvalMismatchIcon" aria-hidden="true"><SvgIcon name="alert-triangle-filled" /></span>
              <span><strong>{mismatchCountLabel(mismatchDays.length, language)}</strong><small>{copy.mismatchHint}</small></span>
              <SvgIcon name="chevron-right" />
            </button> : null}

            <div className="approvalEntries">
              {entryRows.map(row => {
                const date = formatEntryDate(row.date, locale);
                const isMismatch = timesheetReady && PROBLEM_STATUSES.has(row.comparison?.status);
                const projectName = row.entry?.project?.name || (row.entry ? t('common.project') : copy.managerOnlyProject);
                return <article className={`approvalEntry${isMismatch ? ' is-mismatch' : ''}`} key={row.key}>
                  <span className="approvalEntryDot" aria-hidden="true" />
                  <span className="approvalEntryDate"><small>{date.weekday}</small><strong>{date.day}</strong></span>
                  <span className="approvalEntryProject">
                    <strong>{projectName}</strong>
                    {isMismatch && row.isFirstForDate ? <button type="button" onClick={() => setMismatchDate(row.date)}>
                      <SvgIcon name="alert-triangle" />{copy.mismatchWithTimesheet}
                    </button> : null}
                  </span>
                  <strong className="approvalEntryHours">{formatHours(row.entry?.hours ?? row.comparison?.employeeHours ?? 0)}</strong>
                  <button className="approvalEntryMore" type="button" aria-label={copy.entryActions} aria-expanded={actionEntryId === row.key} onClick={() => setActionEntryId(row.key)}>⋮</button>
                </article>;
              })}
            </div>
          </section>

          {actionError && !overlayOpen ? <p className="statusNote is-error approvalInlineError">{actionError}</p> : null}
          <section className="approvalReviewBar" aria-label={t('approvals.decision')}>
            <button className="approvalRejectButton" type="button" disabled={isReviewing} onClick={() => {
              setActionError('');
              setRejectOpen(true);
            }}><span aria-hidden="true">×</span>{copy.reject}</button>
            <button className="approvalApproveButton" type="button" disabled={isReviewing} onClick={() => review('approve')}>
              <SvgIcon name="check-circle" />{isReviewing ? copy.processing : copy.approve(formatHours(detail.summary?.totalHours))}
            </button>
          </section>
        </> : null}
      </article>
    </section> : null}

    {actionEntryId && activeActionRow ? <ModalBackdrop className="approvalActionBackdrop" onClose={() => setActionEntryId('')}>
      <section className="approvalActionMenu" role="dialog" aria-modal="true" aria-label={copy.entryActions}>
        {activeActionRow.entry ? <button type="button" onClick={() => openEditor(activeActionRow.entry)}><SvgIcon name="edit" /><span>{copy.editEntry}</span></button> : null}
        {PROBLEM_STATUSES.has(activeActionRow.comparison?.status) ? <button className="is-warning" type="button" onClick={() => {
          setActionEntryId('');
          setMismatchDate(activeActionRow.date);
        }}><SvgIcon name="alert-triangle-filled" /><span>{copy.viewMismatch}</span></button> : null}
        {activeActionRow.entry ? <button className="is-danger" type="button" disabled={isReviewing} onClick={() => removeEntry(activeActionRow.entry.id)}><SvgIcon name="trash" /><span>{copy.deleteEntry}</span></button> : null}
        {!activeActionRow.entry && !PROBLEM_STATUSES.has(activeActionRow.comparison?.status) ? <button type="button" onClick={() => setActionEntryId('')}>{copy.close}</button> : null}
      </section>
    </ModalBackdrop> : null}

    {weekMenuOpen ? <ModalBackdrop className="approvalActionBackdrop" onClose={() => setWeekMenuOpen(false)}>
      <section className="approvalActionMenu" role="dialog" aria-modal="true" aria-label={copy.weekActions}>
        <button className="is-danger" type="button" disabled={isReviewing} onClick={clearWeek}><SvgIcon name="trash" /><span>{copy.clearWeek}</span></button>
        <button type="button" onClick={() => setWeekMenuOpen(false)}><span>{copy.close}</span></button>
      </section>
    </ModalBackdrop> : null}

    {mismatchDate && activeMismatch ? <ModalBackdrop className="approvalSheetBackdrop" onClose={() => setMismatchDate('')}>
      <section className="approvalBottomSheet approvalMismatchSheet" role="dialog" aria-modal="true" aria-labelledby="approval-mismatch-title">
        <span className="approvalSheetHandle" aria-hidden="true" />
        <header>
          <div><h2 id="approval-mismatch-title">{copy.mismatchTitle}</h2><p>{formatLongDate(mismatchDate, locale)}</p></div>
          <button type="button" aria-label={copy.close} onClick={() => setMismatchDate('')}>×</button>
        </header>
        <section className="approvalMismatchCompare">
          <div><span><SvgIcon name="calendar" />{copy.approvalEntry}</span><strong>{formatHours(activeMismatch.employeeHours)}</strong></div>
          <div><span><SvgIcon name="clock" />{copy.timesheetEntry}</span><strong>{formatHours(activeMismatch.managerHours)}</strong></div>
          <div className="is-difference"><span><SvgIcon name="alert-triangle" />{copy.difference}</span><strong>{formatSignedHours(activeMismatch.employeeHours == null || activeMismatch.managerHours == null ? null : Number(activeMismatch.employeeHours) - Number(activeMismatch.managerHours))}</strong></div>
        </section>
        <section className="approvalMismatchReason"><span>{copy.mismatchReason}</span><p>{getMismatchReason(activeMismatch, copy)}</p></section>
        <section className="approvalMismatchHelp"><h3>{copy.whatToDo}</h3><p>{copy.whatToDoText}</p></section>
        {activeMismatchEntries[0] ? <button className="approvalSheetPrimary" type="button" onClick={() => openEditor(activeMismatchEntries[0])}><SvgIcon name="edit" />{copy.editEntry}</button> : <button className="approvalSheetPrimary" type="button" onClick={() => navigate('/manager/timesheet')}><SvgIcon name="clock" />{copy.openTimesheet}</button>}
        <button className="approvalSheetSecondary" type="button" onClick={() => setMismatchDate('')}>{copy.close}</button>
      </section>
    </ModalBackdrop> : null}

    {editorDraft ? <ModalBackdrop className="approvalSheetBackdrop" onClose={() => setEditorDraft(null)}>
      <section className="approvalBottomSheet approvalEditorSheet" role="dialog" aria-modal="true" aria-labelledby="approval-editor-title">
        <span className="approvalSheetHandle" aria-hidden="true" />
        <header>
          <div><h2 id="approval-editor-title">{copy.editTitle}</h2><p>{formatLongDate(editorDraft.workDate, locale)}</p></div>
          <button type="button" aria-label={copy.close} onClick={() => setEditorDraft(null)}>×</button>
        </header>
        <form onSubmit={saveEntry}>
          <label><span>{copy.project}</span><select value={editorDraft.projectId} disabled={isReviewing || !projects.length} onChange={event => setEditorDraft(current => ({ ...current, projectId: event.target.value }))}>
            {!projects.length ? <option value="">{copy.noProjects}</option> : null}
            {editorDraft.currentProject && !projects.some(project => project.id === editorDraft.currentProject.id) ? <option value={editorDraft.currentProject.id}>{editorDraft.currentProject.name}</option> : null}
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select></label>
          {editorDraft.usesTimes ? <>
            <div className="approvalEditorTimes">
              <label><span>{copy.from}</span><input type="time" value={editorDraft.startTime} onChange={event => setEditorDraft(current => ({ ...current, startTime: event.target.value }))} /></label>
              <label><span>{copy.to}</span><input type="time" value={editorDraft.endTime} onChange={event => setEditorDraft(current => ({ ...current, endTime: event.target.value }))} /></label>
            </div>
            <div className="approvalEditorCalculated"><span>{copy.netHours}</span><strong>{editorNetHours == null ? '—' : formatHours(editorNetHours)}</strong></div>
          </> : <label><span>{copy.hours}</span><input inputMode="decimal" type="number" min="0.01" max="24" step="0.01" value={editorDraft.hours} onChange={event => setEditorDraft(current => ({ ...current, hours: event.target.value }))} /></label>}
          <label><span>{copy.note}</span><textarea rows="3" maxLength="1200" value={editorDraft.note} placeholder={copy.notePlaceholder} onChange={event => setEditorDraft(current => ({ ...current, note: event.target.value }))} /></label>
          {actionError ? <p className="statusNote is-error">{actionError}</p> : null}
          <button className="approvalSheetPrimary" type="submit" disabled={isReviewing || !projects.length}>{updateState.isLoading ? copy.saving : copy.save}</button>
          <button className="approvalSheetSecondary" type="button" disabled={isReviewing} onClick={() => setEditorDraft(null)}>{copy.close}</button>
        </form>
      </section>
    </ModalBackdrop> : null}

    {rejectOpen ? <ModalBackdrop className="approvalSheetBackdrop" onClose={() => setRejectOpen(false)}>
      <section className="approvalBottomSheet approvalRejectSheet" role="dialog" aria-modal="true" aria-labelledby="approval-reject-title">
        <span className="approvalSheetHandle" aria-hidden="true" />
        <header>
          <div><h2 id="approval-reject-title">{copy.rejectTitle}</h2><p>{copy.rejectText}</p></div>
          <button type="button" aria-label={copy.close} onClick={() => setRejectOpen(false)}>×</button>
        </header>
        <label><span>{copy.rejectionReason}</span><textarea autoFocus rows="4" maxLength="500" value={rejectionReason} placeholder={copy.rejectionPlaceholder} onChange={event => setRejectionReason(event.target.value)} /><small>{rejectionReason.length}/500</small></label>
        {actionError ? <p className="statusNote is-error">{actionError}</p> : null}
        <button className="approvalSheetDanger" type="button" disabled={isReviewing || !trimmedRejectionReason} onClick={() => review('reject')}>{rejectState.isLoading ? copy.processing : copy.confirmReject}</button>
        <button className="approvalSheetSecondary" type="button" disabled={isReviewing} onClick={() => setRejectOpen(false)}>{copy.close}</button>
      </section>
    </ModalBackdrop> : null}
  </section>;
}
