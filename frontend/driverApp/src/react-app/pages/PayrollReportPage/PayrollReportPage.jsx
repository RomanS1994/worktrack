import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { hasManagerAccess } from '@shared/features/auth/authAccess.js';
import {
  useGetManagerPayrollQuery,
  useGetWorkSummaryQuery,
} from '../../features/worktrack/worktrackApi.js';
import './PayrollReportPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;

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

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftAnchor(anchor, period, direction) {
  const source = new Date(`${anchor}T00:00:00.000Z`);

  if (period === 'month') {
    return new Date(
      Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + direction, 1)
    )
      .toISOString()
      .slice(0, 10);
  }

  return new Date(source.getTime() + direction * 7 * DAY_MS).toISOString().slice(0, 10);
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
  const [managerPeriod, setManagerPeriod] = useState('week');
  const [managerAnchor, setManagerAnchor] = useState(getLocalDateKey);
  const workSummaryQuery = useGetWorkSummaryQuery({}, { skip: isManager });
  const managerPayrollQuery = useGetManagerPayrollQuery(
    {
      period: managerPeriod,
      anchor: managerAnchor,
    },
    { skip: !isManager }
  );
  const activeQuery = isManager ? managerPayrollQuery : workSummaryQuery;
  const data = activeQuery.data;
  const error = activeQuery.error;
  const isLoading = activeQuery.isLoading || activeQuery.isFetching;
  const summary = data?.summary || {};
  const companyName = data?.company?.name || user?.activeCompany?.name || 'Company';
  const week = data?.week || null;
  const submission = data?.submission || null;
  const hourlyRate = user?.activeMembership?.hourlyRateCzk || user?.hourlyRateCzk || '0.00';
  const managerEmployees = Array.isArray(data?.employees) ? data.employees : [];
  const managerPeriodLabel = useMemo(() => {
    if (!data?.period?.start || !data?.period?.end) return '-';
    return `${data.period.start} - ${data.period.end}`;
  }, [data?.period?.end, data?.period?.start]);

  function changeManagerPeriod(period) {
    setManagerPeriod(period);
  }

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

      {isManager ? (
        <section className="payrollReport-filters screenCard noPrint" aria-label="Payroll period">
          <div className="payrollPeriodToggle" role="group" aria-label="Payroll period type">
            <button
              className={managerPeriod === 'week' ? 'is-active' : ''}
              type="button"
              disabled={isLoading}
              onClick={() => changeManagerPeriod('week')}
            >
              Week
            </button>
            <button
              className={managerPeriod === 'month' ? 'is-active' : ''}
              type="button"
              disabled={isLoading}
              onClick={() => changeManagerPeriod('month')}
            >
              Month
            </button>
          </div>

          <div className="payrollPeriodNavigation">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setManagerAnchor(current => shiftAnchor(current, managerPeriod, -1))}
            >
              ← Previous
            </button>
            <label className="payrollPeriodDate">
              <span>Period date</span>
              <input
                type="date"
                value={managerAnchor}
                disabled={isLoading}
                onChange={event => setManagerAnchor(event.target.value || getLocalDateKey())}
              />
            </label>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setManagerAnchor(current => shiftAnchor(current, managerPeriod, 1))}
            >
              Next →
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setManagerAnchor(getLocalDateKey())}
            >
              Today
            </button>
          </div>
        </section>
      ) : null}

      {isLoading ? <RequestLoadingState label="Preparing payroll report" /> : null}
      {error ? <p className="statusNote is-error noPrint">{getApiErrorMessage(error)}</p> : null}

      {!isLoading && !error ? (
        <article className="payrollReport-sheet">
          <header className="payrollReport-header">
            <div>
              <p className="payrollReport-brand">WorkTrack</p>
              <h2>{isManager ? 'Company payroll report' : 'Employee payroll statement'}</h2>
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
                <ReportRow
                  label="Period type"
                  value={data?.period?.type === 'month' ? 'Month' : 'Week'}
                />
                <ReportRow label="Period" value={managerPeriodLabel} />
                <ReportRow label="Employees" value={String(summary.employeeCount || 0)} />
                <ReportRow
                  label="Employees with hours"
                  value={String(summary.employeesWithHours || 0)}
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

          {isManager ? (
            <section className="payrollReport-employeeSection">
              <div className="payrollReport-sectionHeader">
                <h3>Employee breakdown</h3>
                <span>{managerEmployees.length} employees</span>
              </div>
              <div className="payrollReport-tableWrap">
                <table className="payrollReport-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Status</th>
                      <th>Rate</th>
                      <th>Approved</th>
                      <th>Pending</th>
                      <th>Confirmed</th>
                      <th>Predicted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerEmployees.map(employee => (
                      <tr key={employee.id}>
                        <td>
                          <strong>{employee.name}</strong>
                          <span>{employee.email}</span>
                        </td>
                        <td>{employee.status}</td>
                        <td>{formatCzk(employee.hourlyRateCzk)}</td>
                        <td>{formatHours(employee.summary?.approvedHours)}</td>
                        <td>{formatHours(employee.summary?.pendingHours)}</td>
                        <td>{formatCzk(employee.summary?.confirmedSalaryCzk)}</td>
                        <td>{formatCzk(employee.summary?.predictedSalaryCzk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <footer className="payrollReport-footer">
            <p>
              Confirmed amounts are calculated from approved work entries. Predicted amounts use
              draft and submitted entries and may change after manager review. Rejected work is not
              included in payroll until it is corrected and resubmitted.
            </p>
            <span>Generated by WorkTrack</span>
          </footer>
        </article>
      ) : null}
    </section>
  );
}
