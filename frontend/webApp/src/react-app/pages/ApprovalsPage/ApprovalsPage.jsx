import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  useApproveSubmissionMutation,
  useGetManagerSubmissionQuery,
  useGetManagerSubmissionsQuery,
  useRejectSubmissionMutation,
} from '../../features/worktrack/worktrackApi.js';
import './ApprovalsPage.css';

function getEmployeeName(submission) {
  const employee = submission?.employee;
  return employee?.name || employee?.email || 'Employee';
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPeriod(submission) {
  if (!submission?.weekStart || !submission?.weekEnd) return '-';
  return `${formatDate(submission.weekStart)} – ${formatDate(submission.weekEnd)}`;
}

function formatWorkDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function sortEntries(entries = []) {
  return [...entries].sort((first, second) =>
    String(first.workDate).localeCompare(String(second.workDate))
  );
}

export function ApprovalsPage() {
  const { data, error, isLoading } = useGetManagerSubmissionsQuery({ status: 'SUBMITTED' });
  const submissions = useMemo(
    () => (Array.isArray(data?.submissions) ? data.submissions : []),
    [data],
  );
  const [selectedId, setSelectedId] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const selectedFromList = submissions.find(submission => submission.id === selectedId);
  const detailQuery = useGetManagerSubmissionQuery(selectedId, { skip: !selectedId });
  const detail = detailQuery.data?.submission || selectedFromList || null;
  const [approveSubmission, approveState] = useApproveSubmissionMutation();
  const [rejectSubmission, rejectState] = useRejectSubmissionMutation();
  const isReviewing = approveState.isLoading || rejectState.isLoading;
  const trimmedRejectionReason = rejectionReason.trim();
  const pendingHours = submissions.reduce(
    (total, submission) => total + Number(submission.summary?.totalHours || 0),
    0,
  );

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
    if (!detail?.id) return;
    setActionError('');

    if (decision === 'reject' && !trimmedRejectionReason) {
      setActionError('Add a reason before rejecting this week.');
      return;
    }

    try {
      if (decision === 'approve') {
        await approveSubmission(detail.id).unwrap();
      } else {
        await rejectSubmission({
          submissionId: detail.id,
          rejectionReason: trimmedRejectionReason,
        }).unwrap();
      }
      setRejectionReason('');
      setSelectedId('');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="approvalsPage pageStack">
      <header className="approvalsHeader">
        <div>
          <p className="sectionEyebrow">Manager workspace</p>
          <h1>Approvals</h1>
          <p>Review submitted work weeks and confirm payroll-ready hours.</p>
        </div>
        <div className="approvalsHeaderStats" aria-label="Pending approval summary">
          <div><strong>{submissions.length}</strong><span>Pending weeks</span></div>
          <div><strong>{pendingHours.toFixed(2)} h</strong><span>Hours waiting</span></div>
        </div>
      </header>

      {isLoading ? <RequestLoadingState label="Loading approvals" /> : null}
      {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

      {!isLoading && !submissions.length ? (
        <section className="approvalsEmpty screenCard">
          <span aria-hidden="true"><SvgIcon name="check-circle" /></span>
          <div><h2>You're all caught up</h2><p>There are no submitted weeks waiting for review.</p></div>
        </section>
      ) : null}

      {submissions.length ? (
        <section className="approvalsWorkspace">
          <aside className="approvalsQueue">
            <div className="approvalsQueueHeader">
              <div><span>Pending</span><strong>{submissions.length}</strong></div>
              <p>Select a week to review its entries.</p>
            </div>
            <div className="approvalsList" aria-label="Pending submissions">
              {submissions.map(submission => (
                <button
                  className={`approvalItem ${selectedId === submission.id ? 'is-active' : ''}`}
                  type="button"
                  key={submission.id}
                  onClick={() => setSelectedId(submission.id)}
                >
                  <span className="approvalAvatar" aria-hidden="true">
                    {getEmployeeName(submission).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="approvalItemCopy">
                    <strong>{getEmployeeName(submission)}</strong>
                    <em>{formatPeriod(submission)}</em>
                  </span>
                  <span className="approvalItemMeta">
                    <b>{submission.summary?.totalHours || '0.00'} h</b>
                    <i>Submitted</i>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <article className="approvalDetail">
            {detailQuery.isFetching ? <RequestLoadingState label="Loading details" /> : null}
            {detailQuery.error ? <p className="statusNote is-error">{getApiErrorMessage(detailQuery.error)}</p> : null}

            {detail ? (
              <>
                <div className="approvalDetailHeader">
                  <div className="approvalDetailIdentity">
                    <span className="approvalDetailAvatar" aria-hidden="true">
                      {getEmployeeName(detail).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <span className="approvalStatus">Submitted</span>
                      <h2>{getEmployeeName(detail)}</h2>
                      <p>{formatPeriod(detail)}</p>
                    </div>
                  </div>
                  <div className="approvalTotal">
                    <span>Total hours</span>
                    <strong>{detail.summary?.totalHours || '0.00'} h</strong>
                  </div>
                </div>

                <section className="approvalEntriesSection">
                  <div className="approvalSectionHeader">
                    <h3>Work entries</h3>
                    <span>{detail.entries?.length || 0} entries</span>
                  </div>
                  <div className="approvalEntries">
                    {sortEntries(detail.entries).map(entry => (
                      <div className="approvalEntry" key={entry.id}>
                        <span className="approvalEntryDate">{formatWorkDate(entry.workDate)}</span>
                        <span className="approvalEntryProject">{entry.project?.name || 'Project'}</span>
                        <strong>{entry.hours} h</strong>
                        <em>{String(entry.status || 'SUBMITTED').toLowerCase()}</em>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="approvalDecisionPanel">
                  <div className="approvalDecisionCopy">
                    <h3>Decision</h3>
                    <p>Approve the week, or leave a clear note explaining what needs to change.</p>
                  </div>
                  <div className="approvalRejectionField">
                    <label htmlFor="rejection-reason">Reason for rejection <span>optional until rejecting</span></label>
                    <textarea
                      id="rejection-reason"
                      maxLength={500}
                      value={rejectionReason}
                      disabled={isReviewing}
                      placeholder="Example: Please correct Friday's project and resubmit."
                      onChange={event => setRejectionReason(event.target.value)}
                    />
                    <small>{rejectionReason.length}/500</small>
                  </div>

                  {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

                  <div className="approvalActions">
                    <button
                      className="approvalReject"
                      type="button"
                      disabled={isReviewing || !trimmedRejectionReason}
                      onClick={() => review('reject')}
                    >
                      Reject with note
                    </button>
                    <button
                      className="approvalApprove"
                      type="button"
                      disabled={isReviewing}
                      onClick={() => review('approve')}
                    >
                      <SvgIcon name="check-circle" />
                      Approve week
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
