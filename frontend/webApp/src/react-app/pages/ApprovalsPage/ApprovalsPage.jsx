import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useApproveSubmissionMutation,
  useClearManagerSubmissionMutation,
  useDeleteManagerWorkEntryMutation,
  useGetManagerSubmissionQuery,
  useGetManagerSubmissionsQuery,
  useRejectSubmissionMutation,
} from '../../features/worktrack/worktrackApi.js';
import './ApprovalsPage.css';
import './ApprovalsRedesign.css';
import './ApprovalsActions.css';

const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };
const CLEAR_COPY = {
  uk: {
    deleteEntry: 'Видалити запис',
    clearWeek: 'Очистити тиждень',
    deleteConfirm: 'Видалити цей запис працівника? Цю дію не можна скасувати.',
    clearConfirm: 'Очистити весь цей тиждень працівника? Усі записи та відправка на підтвердження будуть видалені.',
    deleted: 'Запис видалено.',
    cleared: 'Тиждень очищено.',
    back: 'Назад до списку',
    mismatchFound: count => `Є невідповідності у ${count} ${count === 1 ? 'записі' : 'записах'}`,
    reviewMismatch: 'Перевірте записи перед погодженням',
    viewMismatch: 'Переглянути невідповідність',
    editTimesheet: 'Редагувати в табелі',
    mismatchWithTimesheet: 'Невідповідність із табелем',
    employeeSubmission: 'Запис у погодженні',
    managerTimesheet: 'У табелі',
    difference: 'Різниця',
    reasons: 'Причина невідповідності',
    close: 'Закрити',
    hoursReason: 'Не збігається кількість годин',
    breakReason: 'Не збігається перерва',
    projectReason: 'Не збігається об’єкт',
    missingManagerReason: 'У табелі менеджера немає запису за цей день',
    missingEmployeeReason: 'У погодженні працівника немає запису за цей день',
  },
  cs: {
    deleteEntry: 'Smazat záznam',
    clearWeek: 'Vymazat týden',
    deleteConfirm: 'Smazat tento záznam zaměstnance? Tuto akci nelze vrátit zpět.',
    clearConfirm: 'Vymazat celý tento týden zaměstnance? Všechny záznamy a odeslání ke schválení budou odstraněny.',
    deleted: 'Záznam byl smazán.',
    cleared: 'Týden byl vymazán.',
    back: 'Zpět na seznam',
    mismatchFound: count => `Nalezené nesrovnalosti: ${count}`,
    reviewMismatch: 'Před schválením zkontrolujte záznamy',
    viewMismatch: 'Zobrazit nesrovnalost',
    editTimesheet: 'Upravit ve výkazu',
    mismatchWithTimesheet: 'Nesrovnalost s výkazem',
    employeeSubmission: 'Záznam ke schválení',
    managerTimesheet: 'Ve výkazu',
    difference: 'Rozdíl',
    reasons: 'Důvod nesrovnalosti',
    close: 'Zavřít',
    hoursReason: 'Počet hodin se neshoduje',
    breakReason: 'Přestávka se neshoduje',
    projectReason: 'Projekt se neshoduje',
    missingManagerReason: 'Ve výkazu manažera chybí záznam pro tento den',
    missingEmployeeReason: 'V odeslaném týdnu zaměstnance chybí záznam pro tento den',
  },
  en: {
    deleteEntry: 'Delete entry',
    clearWeek: 'Clear week',
    deleteConfirm: 'Delete this employee entry? This action cannot be undone.',
    clearConfirm: 'Clear this employee week? All entries and the submitted week will be deleted.',
    deleted: 'Entry deleted.',
    cleared: 'Week cleared.',
    back: 'Back to list',
    mismatchFound: count => `${count} ${count === 1 ? 'mismatch' : 'mismatches'} found`,
    reviewMismatch: 'Review the entries before approval',
    viewMismatch: 'View mismatch',
    editTimesheet: 'Edit in timesheet',
    mismatchWithTimesheet: 'Timesheet mismatch',
    employeeSubmission: 'Submitted entry',
    managerTimesheet: 'Manager timesheet',
    difference: 'Difference',
    reasons: 'Mismatch reason',
    close: 'Close',
    hoursReason: 'Hours do not match',
    breakReason: 'Break does not match',
    projectReason: 'Project does not match',
    missingManagerReason: 'There is no manager timesheet entry for this day',
    missingEmployeeReason: 'There is no employee submission entry for this day',
  },
};

function getEmployeeName(submission, fallback) { const employee = submission?.employee; return employee?.name || employee?.email || fallback; }
function formatDate(value, locale) { if (!value) return ''; return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`)); }
function formatPeriod(submission, locale) { if (!submission?.weekStart || !submission?.weekEnd) return '-'; return `${formatDate(submission.weekStart, locale)} – ${formatDate(submission.weekEnd, locale)}`; }
function formatWorkDate(value, locale) { if (!value) return ''; return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`)); }
function formatWorkDateParts(value, locale) {
  if (!value) return { weekday: '', day: '' };
  const date = new Date(`${value}T00:00:00.000Z`);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
    day: new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(date),
  };
}
function sortEntries(entries = []) { return [...entries].sort((first, second) => String(first.workDate).localeCompare(String(second.workDate))); }
function isComparisonProblem(comparison) { return comparison && !['EMPTY', 'MATCH'].includes(comparison.status); }
function formatHours(value) { return value == null ? '—' : `${Number(value).toFixed(2)} h`; }

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const clearCopy = CLEAR_COPY[language] || CLEAR_COPY.uk;
  const employeeFallback = t('approvals.employeeFallback');
  const { data, error, isLoading } = useGetManagerSubmissionsQuery({ status: 'SUBMITTED' });
  const submissions = useMemo(() => (Array.isArray(data?.submissions) ? data.submissions : []), [data]);
  const [selectedId, setSelectedId] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [openEntryMenuId, setOpenEntryMenuId] = useState('');
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState(null);
  const selectedFromList = submissions.find(submission => submission.id === selectedId);
  const detailQuery = useGetManagerSubmissionQuery(selectedId, { skip: !selectedId || Boolean(error) });
  const detail = detailQuery.data?.submission || selectedFromList || null;
  const [approveSubmission, approveState] = useApproveSubmissionMutation();
  const [rejectSubmission, rejectState] = useRejectSubmissionMutation();
  const [deleteManagerEntry, deleteState] = useDeleteManagerWorkEntryMutation();
  const [clearManagerSubmission, clearState] = useClearManagerSubmissionMutation();
  const isReviewing = approveState.isLoading || rejectState.isLoading || deleteState.isLoading || clearState.isLoading;
  const trimmedRejectionReason = rejectionReason.trim();
  const pendingHours = submissions.reduce((total, submission) => total + Number(submission.summary?.totalHours || 0), 0);
  const hasQueue = !isLoading && !error;
  const comparisons = Array.isArray(detail?.comparisons) ? detail.comparisons : [];
  const problemComparisons = comparisons.filter(isComparisonProblem);

  useEffect(() => {
    if (!selectedId && submissions[0]?.id) { setSelectedId(submissions[0].id); return; }
    if (selectedId && !submissions.some(submission => submission.id === selectedId)) {
      setSelectedId(submissions[0]?.id || '');
      setMobileDetailOpen(false);
    }
  }, [selectedId, submissions]);

  useEffect(() => {
    setActionError('');
    setRejectionReason('');
    setOpenEntryMenuId('');
    setSectionMenuOpen(false);
    setSelectedComparison(null);
  }, [selectedId]);

  function openSubmission(id) {
    setActionMessage('');
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  function editInTimesheet(comparison) {
    if (!comparison?.date || !detail?.employeeMembershipId) return;
    setOpenEntryMenuId('');
    setSelectedComparison(null);
    const params = new URLSearchParams({ employee: detail.employeeMembershipId, date: comparison.date, from: 'approvals' });
    navigate(`/manager/timesheet?${params.toString()}`);
  }

  async function review(decision) {
    if (!hasQueue || !detail?.id) return;
    setActionError(''); setActionMessage('');
    if (decision === 'reject' && !trimmedRejectionReason) { setActionError(t('approvals.reasonRequired')); return; }
    try {
      if (decision === 'approve') await approveSubmission(detail.id).unwrap();
      else await rejectSubmission({ submissionId: detail.id, rejectionReason: trimmedRejectionReason }).unwrap();
      setRejectionReason(''); setSelectedId(''); setMobileDetailOpen(false);
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function removeEntry(entryId) {
    setOpenEntryMenuId('');
    if (isReviewing || !window.confirm(clearCopy.deleteConfirm)) return;
    setActionError(''); setActionMessage('');
    try {
      await deleteManagerEntry(entryId).unwrap();
      setActionMessage(clearCopy.deleted);
      await detailQuery.refetch();
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function clearWeek() {
    setSectionMenuOpen(false);
    if (!detail?.id || isReviewing || !window.confirm(clearCopy.clearConfirm)) return;
    setActionError(''); setActionMessage('');
    try {
      await clearManagerSubmission(detail.id).unwrap();
      setSelectedId(''); setMobileDetailOpen(false);
      setActionMessage(clearCopy.cleared);
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  function getReasonText(reason) {
    if (reason === 'hours') return clearCopy.hoursReason;
    if (reason === 'break') return clearCopy.breakReason;
    if (reason === 'project') return clearCopy.projectReason;
    if (reason === 'missingManager') return clearCopy.missingManagerReason;
    if (reason === 'missingEmployee') return clearCopy.missingEmployeeReason;
    return reason;
  }

  return <section className="approvalsPage pageStack">
    <header className="approvalsHeader"><div><p className="sectionEyebrow">{t('approvals.eyebrow')}</p><h1>{t('approvals.title')}</h1><p>{t('approvals.intro')}</p></div>{hasQueue ? <div className="approvalsHeaderStats" aria-label={t('approvals.pendingSummary')}><div><strong>{submissions.length}</strong><span>{t('approvals.pendingWeeks')}</span></div><div><strong>{pendingHours.toFixed(2)} h</strong><span>{t('approvals.hoursWaiting')}</span></div></div> : null}</header>
    {isLoading ? <RequestLoadingState label={t('approvals.loading')} /> : null}
    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
    {actionMessage ? <p className="statusNote is-success">{actionMessage}</p> : null}
    {hasQueue && !submissions.length ? <section className="approvalsEmpty screenCard"><span aria-hidden="true"><SvgIcon name="check-circle" /></span><div><h2>{t('approvals.allCaughtUp')}</h2><p>{t('approvals.noPending')}</p></div></section> : null}
    {hasQueue && submissions.length ? <section className={`approvalsWorkspace${mobileDetailOpen ? ' is-mobile-detail' : ''}`}>
      <aside className="approvalsQueue"><div className="approvalsQueueHeader"><div><span>{t('approvals.pending')}</span><strong>{submissions.length}</strong></div><p>{t('approvals.selectWeek')}</p></div><div className="approvalsList" aria-label={t('approvals.pendingSubmissions')}>{submissions.map(submission => <button className={`approvalItem ${selectedId === submission.id ? 'is-active' : ''}`} type="button" key={submission.id} onClick={() => openSubmission(submission.id)}><span className="approvalAvatar" aria-hidden="true">{getEmployeeName(submission, employeeFallback).slice(0, 1).toUpperCase()}</span><span className="approvalItemCopy"><strong>{getEmployeeName(submission, employeeFallback)}</strong><em>{formatPeriod(submission, locale)}</em></span><span className="approvalItemMeta"><b>{submission.summary?.totalHours || '0.00'} h</b><i>{t('approvals.submittedStatus')}</i></span><span className="approvalItemChevron" aria-hidden="true">›</span></button>)}</div></aside>
      <article className="approvalDetail">
        <button className="approvalMobileBack" type="button" onClick={() => setMobileDetailOpen(false)}>‹ {clearCopy.back}</button>
        {detailQuery.isFetching ? <RequestLoadingState label={t('approvals.loadingDetails')} /> : null}
        {detailQuery.error ? <p className="statusNote is-error">{getApiErrorMessage(detailQuery.error)}</p> : null}
        {detail && !detailQuery.error ? <>
          <div className="approvalDetailHeader"><div className="approvalDetailIdentity"><span className="approvalDetailAvatar" aria-hidden="true">{getEmployeeName(detail, employeeFallback).slice(0, 1).toUpperCase()}</span><div><span className="approvalStatus">{t('approvals.submittedStatus')}</span><h2>{getEmployeeName(detail, employeeFallback)}</h2><p>{formatPeriod(detail, locale)}</p></div></div><div className="approvalTotal"><span>{t('approvals.totalHours')}</span><strong>{detail.summary?.totalHours || '0.00'} h</strong></div></div>
          <section className="approvalEntriesSection">
            <div className="approvalSectionHeader">
              <h3>{t('approvals.workEntries')}</h3>
              <div className="approvalSectionMenuWrap">
                <button className="approvalMoreButton" type="button" aria-label={clearCopy.clearWeek} aria-expanded={sectionMenuOpen} onClick={() => { setSectionMenuOpen(value => !value); setOpenEntryMenuId(''); }}>•••</button>
                {sectionMenuOpen ? <div className="approvalSectionMenu"><button type="button" disabled={isReviewing} onClick={clearWeek}>{clearCopy.clearWeek}</button></div> : null}
              </div>
            </div>
            {problemComparisons.length ? <button className="approvalMismatchSummary" type="button" onClick={() => setSelectedComparison(problemComparisons[0])}>
              <span className="approvalMismatchIcon" aria-hidden="true">!</span>
              <span><strong>{clearCopy.mismatchFound(problemComparisons.length)}</strong><small>{clearCopy.reviewMismatch}</small></span>
              <span className="approvalMismatchChevron" aria-hidden="true">›</span>
            </button> : null}
            <div className="approvalEntries approvalTimeline">{sortEntries(detail.entries).map(entry => {
              const dateParts = formatWorkDateParts(entry.workDate, locale);
              const comparison = entry.comparison || comparisons.find(item => item.date === entry.workDate) || null;
              const hasMismatch = isComparisonProblem(comparison);
              const menuOpen = openEntryMenuId === entry.id;
              return <div className={`approvalEntry${hasMismatch ? ' has-mismatch' : ''}`} key={entry.id}>
                <span className="approvalTimelineRail" aria-hidden="true"><i /></span>
                <span className="approvalEntryDate"><b>{dateParts.weekday}</b><em>{dateParts.day}</em></span>
                <span className="approvalEntryMain">
                  <span className="approvalEntryProject">{entry.project?.name || t('common.project')}</span>
                  {hasMismatch ? <button className="approvalEntryMismatch" type="button" onClick={() => setSelectedComparison(comparison)}>⚠ {clearCopy.mismatchWithTimesheet}</button> : null}
                </span>
                <strong className="approvalEntryHours">{entry.hours} h</strong>
                <span className="approvalEntryMenuWrap">
                  <button className="approvalEntryMore" type="button" aria-label="Actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? '' : entry.id); setSectionMenuOpen(false); }}>⋮</button>
                  {menuOpen ? <span className="approvalEntryMenu">
                    {hasMismatch ? <button type="button" className="is-warning" onClick={() => { setSelectedComparison(comparison); setOpenEntryMenuId(''); }}>⚠ {clearCopy.viewMismatch}</button> : null}
                    {hasMismatch ? <button type="button" className="is-edit" onClick={() => editInTimesheet(comparison)}>✎ {clearCopy.editTimesheet}</button> : null}
                    <button type="button" className="is-danger" disabled={isReviewing} onClick={() => removeEntry(entry.id)}>⌫ {clearCopy.deleteEntry}</button>
                  </span> : null}
                </span>
              </div>;
            })}</div>
          </section>
          <section className="approvalDecisionPanel"><div className="approvalDecisionCopy"><h3>{t('approvals.decision')}</h3><p>{t('approvals.decisionCopy')}</p></div><div className="approvalRejectionField"><label htmlFor="rejection-reason">{t('approvals.rejectionReason')} <span>{t('approvals.optionalUntilRejecting')}</span></label><textarea id="rejection-reason" maxLength={500} value={rejectionReason} disabled={isReviewing} placeholder={t('approvals.rejectionPlaceholder')} onChange={event => setRejectionReason(event.target.value)} /><small>{rejectionReason.length}/500</small></div>{actionError ? <p className="statusNote is-error">{actionError}</p> : null}<div className="approvalActions"><button className="approvalReject" type="button" disabled={isReviewing || !trimmedRejectionReason} onClick={() => review('reject')}>{t('approvals.rejectWithNote')}</button><button className="approvalApprove" type="button" disabled={isReviewing} onClick={() => review('approve')}><SvgIcon name="check-circle" />{t('approvals.approveWeek')}</button></div></section>
          {selectedComparison ? <div className="approvalMismatchOverlay" role="presentation" onClick={() => setSelectedComparison(null)}>
            <section className="approvalMismatchSheet" role="dialog" aria-modal="true" aria-label={clearCopy.mismatchWithTimesheet} onClick={event => event.stopPropagation()}>
              <span className="approvalSheetHandle" aria-hidden="true" />
              <div className="approvalMismatchSheetHeader"><div><h3>{clearCopy.mismatchWithTimesheet}</h3><p>{formatWorkDate(selectedComparison.date, locale)}</p></div><button type="button" aria-label={clearCopy.close} onClick={() => setSelectedComparison(null)}>×</button></div>
              <div className="approvalMismatchValues">
                <div><span>{clearCopy.employeeSubmission}</span><strong>{formatHours(selectedComparison.employeeHours)}</strong></div>
                <div><span>{clearCopy.managerTimesheet}</span><strong>{formatHours(selectedComparison.managerHours)}</strong></div>
                {selectedComparison.difference != null ? <div className="is-difference"><span>{clearCopy.difference}</span><strong>{selectedComparison.difference > 0 ? '+' : ''}{Number(selectedComparison.difference).toFixed(2)} h</strong></div> : null}
              </div>
              <div className="approvalMismatchReasons"><span>{clearCopy.reasons}</span>{(selectedComparison.reasons || []).map(reason => <p key={reason}>⚠ {getReasonText(reason)}</p>)}</div>
              <div className="approvalMismatchSheetActions">
                <button className="approvalMismatchEdit" type="button" onClick={() => editInTimesheet(selectedComparison)}>✎ {clearCopy.editTimesheet}</button>
                <button className="approvalMismatchClose" type="button" onClick={() => setSelectedComparison(null)}>{clearCopy.close}</button>
              </div>
            </section>
          </div> : null}
        </> : null}
      </article>
    </section> : null}
  </section>;
}