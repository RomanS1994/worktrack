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

function formatPeriod(submission) {
  if (!submission?.weekStart || !submission?.weekEnd) return '-';
  return `${submission.weekStart} - ${submission.weekEnd}`;
}

function sortEntries(entries = []) {
  return [...entries].sort((first, second) =>
    String(first.workDate).localeCompare(String(second.workDate))
  );
}

export function ApprovalsPage() {
  const { data, error, isLoading } = useGetManagerSubmissionsQuery({
    status: 'SUBMITTED',
  });
  const submissions = useMemo(
    () => (Array.isArray(data?.submissions) ? data.submissions : []),
    [data],
  );
  const [selectedId, setSelectedId] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const selectedFromList = submissions.find(submission => submission.id === selectedId);
  const detailQuery = useGetManagerSubmissionQuery(selectedId, {
    skip: !selectedId,
  });
  const detail = detailQuery.data?.submission || selectedFromList || null;
  const [approveSubmission, approveState] = useApproveSubmissionMutation();
  const [rejectSubmission, rejectState] = useRejectSubmissionMutation();
  const isReviewing = approveState.isLoading || rejectState.isLoading;
  const trimmedRejectionReason = rejectionReason.trim();

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
      <header className="approvalsHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Review</p>
          <h1>Approvals</h1>
          <p>{submissions.length} pending submissions</p>
        </div>
      </header>

      <section className="approvalsPanel screenCard">
        <div className="compactHeader">
          <h2>Weekly submissions</h2>
          <p>Submitted weeks from your employees.</p>
        </div>

        {isLoading ? <RequestLoadingState label="Loading approvals" /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

        {!isLoading && !submissions.length ? (
          <div className="approvalsStatusRow">
            <span aria-hidden="true">
              <SvgIcon name="check-circle" />
            </span>
            <strong>Review queue is empty</strong>
          </div>
        ) : null}

        {submissions.length ? (
          <div className="approvalsLayout">
            <div className="approvalsList" aria-label="Pending submissions">
              {submissions.map(submission => (
                <button
                  className={`approvalItem ${selectedId === submission.id ? 'is-active' : ''}`}
                  type="button"
                  key={submission.id}
                  onClick={() => setSelectedId(submission.id)}
                >
                  <span>
                    <strong>{getEmployeeName(submission)}</strong>
                    <em>{formatPeriod(submission)}</em>
                  </span>
                  <b>{submission.summary?.totalHours || '0.00'} h</b>
                </button>
              ))}
            </div>

            <article className="approvalDetail">
              {detailQuery.isFetching ? <RequestLoadingState label="Loading details" /> : null}
              {detailQuery.error ? (
                <p className="statusNote is-error">{getApiErrorMessage(detailQuery.error)}</p>
              ) : null}

              {detail ? (
                <>
                  <div className="approvalDetail-header">
                    <div>
                      <p className="sectionEyebrow">{detail.status}</p>
                      <h2>{getEmployeeName(detail)}</h2>
                      <span>{formatPeriod(detail)}</span>
                    </div>
                    <strong>{detail.summary?.totalHours || '0.00'} h</strong>
                  </div>

                  <div className="approvalEntries">
                    {sortEntries(detail.entries).map(entry => (
                      <div className="approvalEntry" key={entry.id}>
                        <span>{entry.workDate}</span>
                        <span>{entry.project?.name || 'Project'}</span>
                        <strong>{entry.hours} h</strong>
                        <em>{entry.status}</em>
                      </div>
                    ))}
                  </div>

                  <div className="approvalRejectionField">
                    <label htmlFor="rejection-reason">Reason for rejection</label>
                    <textarea
                      id="rejection-reason"
                      maxLength={500}
                      value={rejectionReason}
                      disabled={isReviewing}
                      placeholder="Explain what the employee should correct before resubmitting."
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
                      Reject
                    </button>
                    <button
                      className="approvalApprove"
                      type="button"
                      disabled={isReviewing}
                      onClick={() => review('approve')}
                    >
                      Approve
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          </div>
        ) : null}
      </section>
    </section>
  );
}
