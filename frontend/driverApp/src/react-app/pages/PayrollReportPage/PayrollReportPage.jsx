import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import { useGetWorkSummaryQuery } from '../../features/worktrack/worktrackApi.js';
import './PayrollReportPage.css';

function formatCzk(value) {
  return `${value || '0.00'} CZK`;
}

function formatHours(value) {
  return `${value || '0.00'} h`;
}

function getEmployeeName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.name || user?.email || 'Employee';
}

function ReportRow({ label, value, emphasize = false }) {
  return (
    <div className={`payrollReport-row${emphasize ? ' is-emphasized' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PayrollReportPage() {
  const user = useSelector(selectUser);
  const isManager = hasManagerAccess(user);
  const { data, error, isLoading } = useGetWorkSummaryQuery();
  const summary = data?.summary || {};
  const companyName = data?.company?.name || user?.activeCompany?.name || 'Company';
  const week = data?.week || null;
  const submission = data?.submission || null;
  const hourlyRate = user?.activeMembership?.hourlyRateCzk || user?.hourlyRateCzk || '0.00';

  function printReport() {
    window.print();
  }

  return (
    <section className="payrollReportPage pageStack">
      <header className="payrollReport-toolbar screenCard noPrint">
        <div className="compactHeader">
          <h1>Payroll report</h1>
          <p>Use your browser print dialog and choose “Save as PDF”.</p>
        </div>
        <div className="payrollReport-actions">
          <Link to="/dashboard">Back to dashboard</Link>
          <button type="button" onClick={printReport} disabled={isLoading || Boolean(error)}>
            Print / Save PDF
          </button>
        </div>
      </header>

      {isLoading ? <RequestLoadingState label="Preparing payroll report" /> : null}
      {error ? <p className="statusNote is-error noPrint">{getApiErrorMessage(error)}</p> : null}

      {!isLoading && !error ? (
        <article className="payrollReport-sheet">
          <header className="payrollReport-header">
            <div>
              <p className="payrollReport-brand">WorkTrack</p>
              <h2>{isManager ? 'Company payroll summary' : 'Employee payroll statement'}</h2>
            </div>
            <div className="payrollReport-company">
              <strong>{companyName}</strong>
              <span>{isManager ? 'Manager report' : getEmployeeName(user)}</span>
            </div>
          </header>

          <section className="payrollReport-meta">
            {!isManager && week ? (
              <>
                <ReportRow label="Week start" value={week.weekStart || '-'} />
                <ReportRow label="Week end" value={week.weekEnd || '-'} />
                <ReportRow label="Week status" value={submission?.status || 'DRAFT'} />
                <ReportRow label="Hourly rate" value={formatCzk(hourlyRate)} />
              </>
            ) : (
              <>
                <ReportRow label="Active employees" value={String(summary.employeeCount || 0)} />
                <ReportRow label="Active projects" value={String(summary.activeProjectCount || 0)} />
                <ReportRow
                  label="Pending submissions"
                  value={String(summary.pendingSubmissions || 0)}
                />
              </>
            )}
          </section>

          <section className="payrollReport-summary">
            <h3>{isManager ? 'Payroll totals' : 'Hours and salary'}</h3>

            {isManager ? (
              <>
                <ReportRow label="Approved hours" value={formatHours(summary.approvedHours)} />
                <ReportRow label="Pending hours" value={formatHours(summary.pendingHours)} />
                <ReportRow
                  label="Confirmed payroll"
                  value={formatCzk(summary.confirmedSalaryCzk)}
                  emphasize
                />
                <ReportRow
                  label="Predicted payroll"
                  value={formatCzk(summary.predictedSalaryCzk)}
                />
              </>
            ) : (
              <>
                <ReportRow label="Total saved hours" value={formatHours(summary.totalHours)} />
                <ReportRow label="Approved hours" value={formatHours(summary.approvedHours)} />
                <ReportRow label="Pending hours" value={formatHours(summary.pendingHours)} />
                <ReportRow
                  label="Confirmed salary"
                  value={formatCzk(summary.confirmedSalaryCzk)}
                  emphasize
                />
                <ReportRow
                  label="Predicted salary"
                  value={formatCzk(summary.predictedSalaryCzk)}
                />
              </>
            )}
          </section>

          <footer className="payrollReport-footer">
            <p>
              Confirmed amounts are calculated from approved work entries. Predicted amounts use
              draft and submitted entries and may change after manager review.
            </p>
            <span>Generated by WorkTrack</span>
          </footer>
        </article>
      ) : null}
    </section>
  );
}
