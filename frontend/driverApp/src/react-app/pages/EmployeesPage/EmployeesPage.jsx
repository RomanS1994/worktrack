import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  useCreateManagerEmployeeMutation,
  useGetManagerEmployeesQuery,
  useResetManagerEmployeePasswordMutation,
  useUpdateManagerEmployeeMutation,
} from '../../features/worktrack/worktrackApi.js';
import './EmployeesPage.css';

const EMPTY_EMPLOYEE_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  temporaryPassword: '',
  hourlyRateCzk: '',
};

function getEmployeeName(employee) {
  return employee?.name || employee?.email || 'Employee';
}

export function EmployeesPage() {
  const { data, error, isLoading } = useGetManagerEmployeesQuery();
  const [createManagerEmployee, createState] = useCreateManagerEmployeeMutation();
  const [updateManagerEmployee, updateState] = useUpdateManagerEmployeeMutation();
  const [resetManagerEmployeePassword, resetState] = useResetManagerEmployeePasswordMutation();
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [rateDrafts, setRateDrafts] = useState({});
  const [resetEmployeeId, setResetEmployeeId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const activeEmployeeCount = employees.filter(employee => employee.status === 'ACTIVE').length;
  const isMutating = createState.isLoading || updateState.isLoading || resetState.isLoading;

  useEffect(() => {
    setRateDrafts(
      employees.reduce((next, employee) => {
        next[employee.id] = employee.hourlyRateCzk || '0.00';
        return next;
      }, {})
    );
  }, [employees]);

  function clearActionMessages() {
    setActionError('');
    setActionSuccess('');
  }

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitEmployee(event) {
    event.preventDefault();
    clearActionMessages();

    try {
      await createManagerEmployee(form).unwrap();
      setForm(EMPTY_EMPLOYEE_FORM);
      setActionSuccess('Employee added. Share the temporary password securely.');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function saveRate(employeeId) {
    clearActionMessages();

    try {
      await updateManagerEmployee({
        employeeId,
        hourlyRateCzk: rateDrafts[employeeId],
      }).unwrap();
      setActionSuccess('Hourly rate updated.');
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function toggleEmployeeStatus(employee) {
    clearActionMessages();
    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await updateManagerEmployee({
        employeeId: employee.id,
        status: nextStatus,
      }).unwrap();
      setActionSuccess(
        nextStatus === 'ACTIVE' ? 'Employee reactivated.' : 'Employee deactivated.'
      );
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  function openPasswordReset(employeeId) {
    clearActionMessages();
    setResetPassword('');
    setResetEmployeeId(employeeId);
  }

  function closePasswordReset() {
    setResetPassword('');
    setResetEmployeeId('');
  }

  async function submitPasswordReset(employee) {
    clearActionMessages();

    if (resetPassword.length < 8) {
      setActionError('Temporary password must be at least 8 characters long.');
      return;
    }

    try {
      await resetManagerEmployeePassword({
        employeeId: employee.id,
        temporaryPassword: resetPassword,
      }).unwrap();
      closePasswordReset();
      setActionSuccess(
        `Password reset for ${getEmployeeName(employee)}. Their existing sessions were signed out.`
      );
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  return (
    <section className="employeesPage pageStack">
      <header className="employeesHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">Team</p>
          <h1>Employees</h1>
          <p>
            {activeEmployeeCount} active · {employees.length} total
          </p>
        </div>
      </header>

      <section className="employeesWorkspace">
        <form className="employeesCreate screenCard" onSubmit={submitEmployee}>
          <div className="compactHeader">
            <h2>Add employee</h2>
            <p>The employee must replace the temporary password after the first sign in.</p>
          </div>

          <div className="employeesFormGrid">
            <label className="employeesField">
              <span>First name</span>
              <input
                type="text"
                value={form.firstName}
                onChange={event => updateForm('firstName', event.target.value)}
              />
            </label>

            <label className="employeesField">
              <span>Last name</span>
              <input
                type="text"
                value={form.lastName}
                onChange={event => updateForm('lastName', event.target.value)}
              />
            </label>
          </div>

          <label className="employeesField">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={event => updateForm('email', event.target.value)}
            />
          </label>

          <div className="employeesFormGrid">
            <label className="employeesField">
              <span>Temporary password</span>
              <input
                type="password"
                minLength={8}
                value={form.temporaryPassword}
                onChange={event => updateForm('temporaryPassword', event.target.value)}
              />
            </label>

            <label className="employeesField">
              <span>Hourly rate CZK</span>
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRateCzk}
                onChange={event => updateForm('hourlyRateCzk', event.target.value)}
              />
            </label>
          </div>

          <button className="employeesPrimaryButton" type="submit" disabled={isMutating}>
            Add employee
          </button>
        </form>

        <section className="employeesPanel screenCard">
          <div className="compactHeader">
            <h2>Employee list</h2>
            <p>{data?.week ? `${data.week.weekStart} - ${data.week.weekEnd}` : 'Current week'}</p>
          </div>

          {actionError ? <p className="statusNote is-error">{actionError}</p> : null}
          {actionSuccess ? <p className="statusNote is-success">{actionSuccess}</p> : null}
          {isLoading ? <RequestLoadingState label="Loading employees" /> : null}
          {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}

          {!isLoading && !employees.length ? (
            <div className="employeesEmpty">
              <span aria-hidden="true">
                <SvgIcon name="accounts" />
              </span>
              <strong>No employees yet</strong>
            </div>
          ) : null}

          {employees.length ? (
            <div className="employeesList">
              {employees.map(employee => {
                const isActive = employee.status === 'ACTIVE';
                const isResettingPassword = resetEmployeeId === employee.id;

                return (
                  <article
                    className={`employeeCard${isActive ? '' : ' is-inactive'}`}
                    key={employee.id}
                  >
                    <div className="employeeCard-main">
                      <span className="employeeCard-avatar" aria-hidden="true">
                        {getEmployeeName(employee).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{getEmployeeName(employee)}</strong>
                        <p>{employee.email}</p>
                      </div>
                    </div>

                    <div className="employeeCard-metrics">
                      <span>
                        <strong>{employee.summary?.totalHours || '0.00'} h</strong>
                        <em>week</em>
                      </span>
                      <span>
                        <strong>{employee.pendingSubmissions || 0}</strong>
                        <em>pending</em>
                      </span>
                      <span>
                        <strong>{employee.status || 'ACTIVE'}</strong>
                        <em>status</em>
                      </span>
                    </div>

                    <div className="employeeRateEditor">
                      <label>
                        <span>Rate CZK</span>
                        <input
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.01"
                          value={rateDrafts[employee.id] || ''}
                          onChange={event =>
                            setRateDrafts(current => ({
                              ...current,
                              [employee.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="employeeCard-actions">
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => saveRate(employee.id)}
                        >
                          Save rate
                        </button>
                        <button
                          className={isActive ? 'is-deactivate' : 'is-activate'}
                          type="button"
                          disabled={isMutating}
                          onClick={() => toggleEmployeeStatus(employee)}
                        >
                          {isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          className="is-password-reset"
                          type="button"
                          disabled={isMutating}
                          onClick={() =>
                            isResettingPassword ? closePasswordReset() : openPasswordReset(employee.id)
                          }
                        >
                          {isResettingPassword ? 'Cancel reset' : 'Reset password'}
                        </button>
                      </div>

                      {isResettingPassword ? (
                        <div className="employeePasswordReset">
                          <label>
                            <span>New temporary password</span>
                            <input
                              type="password"
                              minLength={8}
                              autoComplete="new-password"
                              value={resetPassword}
                              placeholder="At least 8 characters"
                              disabled={isMutating}
                              onChange={event => setResetPassword(event.target.value)}
                            />
                          </label>
                          <p>
                            Existing sessions will be signed out. The employee must change this
                            password after signing in.
                          </p>
                          <button
                            type="button"
                            disabled={isMutating || resetPassword.length < 8}
                            onClick={() => submitPasswordReset(employee)}
                          >
                            Set temporary password
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}
