import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useApproveSubmissionMutation,
  useGetManagerSubmissionQuery,
  useGetManagerSubmissionsQuery,
  useRejectSubmissionMutation,
} from '../../features/worktrack/worktrackApi.js';
import './ApprovalsPage.css';

const LOCALES = { uk: 'uk-UA', en: 'en-GB', cs: 'cs-CZ' };

function getEmployeeName(submission, fallback) {
  const employee = submission?.employee;
  return employee?.name || employee?.email || fallback;
}

function formatDate(value, locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPeriod(submission, locale) {
  if (!submission?.weekStart || !submission?.weekEnd) return '-';
  return `${formatDate(submission.weekStart, locale)} – ${formatDate(submission.weekEnd, locale)}`;
}

function formatWorkDate(value, locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function sortEntries(entries = []) {
  return [...entries].sort((first, second) => String(first.workDate).localeCompare(String(second.workDate)));
}

export function ApprovalsPage() {
  const { language, t } = useI18n();
  const locale = LOCALES[language] || LOCALES.uk;
  const employeeFallback = t('approvals.employeeFallback');
  const { data, error, isLoading } = useGetManagerSubmissionsQuery({ status: 'SUBMITTED' });
  const submissions = useMemo(() => (Array.isArray(data?.submissions) ? data.submissions : []), [data]);
  const [selectedId, setSelectedId] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const selectedFromList = submissions.find(submission => submission.id === selectedId);
  const detailQuery = useGetManagerSubmissionQuery(selectedId, { skip: !selectedId || Boolean(error) });
  const detail = detailQuery.data?.submission || selectedFromList || null;
  const [approveSubmission, approveState] = useApproveSubmissionMutation();
  const [rejectSubmission, rejectState] = useRejectSubmissionMutation();
  const isReviewing = approveState.isLoading || rejectState.isLoading;
  const trimmedRejectionReason = rejectionReason.trim();
  const pendingHours = submissions.reduce((total, submission) => total + Number(submission.summary?.totalHours || 0), 0);
  const hasQueue = !isLoading && !error;

  useEffect(() => {
    if (!selectedId && submissions[0]?.id) {
      setSelectedId(submissions[0].id);
      return;
    }
    if (selectedId && !submissions.some(submission => submission.id === selectedId)) {
      setSelectedId(submissions[0]?.id || '');
    }
  }, [selectedId, submissions]);

  useEffect(() => {
    setActionError('');
    setRejectionReason('');
  }, [selectedId]);

  async function review(decision) {
    if (!hasQueue || !detail?.id) return;
    setActionError('');
    if (decision === 'reject' && !trimmedRejectionReason) {
      setActionError(t('approvals.reasonRequired'));
      return;
    }
    try {
      if (decision === 'approve') {
        await approveSubmission(detail.id).unwrap();
      } else {
        await rejectSubmission({ submissionId: detail.id, rejectionReason: trimmedRejectionReason }).unwrap();
      }
      setRejectionReason('');
      setSelectedId('');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  const statusLabel = status => t(`common.${String(status || 'submitted').toLowerCase()}`);

  return (
    <section className="approvalsPage pageStack">
      <header className="approvalsHeader">
        <div>
          <p className="sectionEyebrow">{t('approvals.eyebrow')}</p>
          <h1>{t('approvals.title')}</h1>
          <p>{t('approvals.intro')}</p>
        </div>
        {hasQueue ? (
          <div className="approvalsHeaderStats" aria-label={t('approvals.pendingSummary')}>
            <div><strong>{submissions.length}</strong><span>{t('approvals.pendingWeeks')}</span></div>
            <div><strong>{pendingHours.toFixed(2)} h</strong><span>{t('approvals.hoursWaiting')}</span></div>
          </div>
        ) : null}
      </header>

      {isLoading ? <RequestLoadingState label={t('approvals.loading')} /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

      {hasQueue && !submissions.length ? (
        <section className="approvalsEmpty screenCard">
          <span aria-hidden="true"><SvgIcon name="check-circle" /></span>
          <div><h2>{t('approvals.allCaughtUp')}</h2><p>{t('approvals.noPending')}</p></div>
        </section>
      ) : null}

      {hasQueue && submissions.length ? (
        <section className="approvalsWorkspace">
          <aside className="approvalsQueue">
            <div className="approvalsQueueHeader">
              <div><span>{t('approvals.pending')}</span><strong>{submissions.length}</strong></div>
              <p>{t('approvals.selectWeek')}</p>
            </div>
            <div className="approvalsList" aria-label={t('approvals.pendingSubmissions')}>
              {submissions.map(submission => (
                <button
                  className={`approvalItem ${selectedId === submission.id ? 'is-active' : ''}`}
                  type="button"
                  key={submission.id}
                  onClick={() => setSelectedId(submission.id)}
                >
                  <span className="approvalAvatar" aria-hidden="true">{getEmployeeName(submission, employeeFallback).slice(0, 1).toUpperCase()}</span>
                  <span className="approvalItemCopy">
                    <strong>{getEmployeeName(submission, employeeFallback)}</strong>
                    <em>{formatPeriod(submission, locale)}</em>
                  </span>
                  <span className="approvalItemMeta">
                    <b>{submission.summary?.totalHours || '0.00'} h</b>
                    <i>{t('approvals.submittedStatus')}</i>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <article className="approvalDetail">
            {detailQuery.isFetching ? <RequestLoadingState label={t('approvals.loadingDetails')} /> : null}
            {detailQuery.error ? <p className="statusNote is-error">{getApiErrorMessage(detailQuery.error)}</p> : null}

            {detail && !detailQuery.error ? (
              <>
                <div className="approvalDetailHeader">
                  <div className="approvalDetailIdentity">
                    <span className="approvalDetailAvatar" aria-hidden="true">{getEmployeeName(detail, employeeFallback).slice(0, 1).toUpperCase()}</span>
                    <div>
                      <span className="approvalStatus">{t('approvals.submittedStatus')}</span>
                      <h2>{getEmployeeName(detail, employeeFallback)}</h2>
                      <p>{formatPeriod(detail, locale)}</p>
                    </div>
                  </div>
                  <div className="approvalTotal">
                    <span>{t('approvals.totalHours')}</span>
                    <strong>{detail.summary?.totalHours || '0.00'} h</strong>
                  </div>
                </div>

                <section className="approvalEntriesSection">
                  <div className="approvalSectionHeader">
                    <h3>{t('approvals.workEntries')}</h3>
                    <span>{detail.entries?.length || 0} {t('common.entries')}</span>
                  </div>
                  <div className="approvalEntries">
                    {sortEntries(detail.entries).map(entry => (
                      <div className="approvalEntry" key={entry.id}>
                        <span className="approvalEntryDate">{formatWorkDate(entry.workDate, locale)}</span>
                        <span className="approvalEntryProject">{entry.project?.name || t('common.project')}</span>
                        <strong>{entry.hours} h</strong>
                        <em>{statusLabel(entry.status)}</em>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="approvalDecisionPanel">
                  <div className="approvalDecisionCopy">
                    <h3>{t('approvals.decision')}</h3>
                    <p>{t('approvals.decisionCopy')}</p>
                  </div>
                  <div className="approvalRejectionField">
                    <label htmlFor="rejection-reason">{t('approvals.rejectionReason')} <span>{t('approvals.optionalUntilRejecting')}</span></label>
                    <textarea
                      id="rejection-reason"
                      maxLength={500}
                      value={rejectionReason}
                      disabled={isReviewing}
                      placeholder={t('approvals.rejectionPlaceholder')}
                      onChange={event => setRejectionReason(event.target.value)}
                    />
                    <small>{rejectionReason.length}/500</small>
                  </div>

                  {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

                  <div className="approvalActions">
                    <button className="approvalReject" type="button" disabled={isReviewing || !trimmedRejectionReason} onClick={() => review('reject')}>
                      {t('approvals.rejectWithNote')}
                    </button>
                    <button className="approvalApprove" type="button" disabled={isReviewing} onClick={() => review('approve')}>
                      <SvgIcon name="check-circle" />
                      {t('approvals.approveWeek')}
                    </button>
                  </div>
                </section>
              </>
            ) : null}
          </article>
        </section>
      ) : null}
    </section>
  );
}
