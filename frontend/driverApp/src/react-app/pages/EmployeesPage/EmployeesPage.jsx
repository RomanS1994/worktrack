import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import {
  useCreateManagerEmployeeMutation,
  useGetManagerEmployeesQuery,
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
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [rateDrafts, setRateDrafts] = useState({});
  const [actionError, setActionError] = useState('');
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const isMutating = createState.isLoading || updateState.isLoading;

  useEffect(() => {
    setRateDrafts(
      employees.reduce((next, employee) => {
        next[employee.id] = employee.hourlyRateCzk || '0.00';
        return next;
      }, {})
    );
  }, [employees]);

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitEmployee(event) {
    event.preventDefault();
    setActionError('');

    try {
      await createManagerEmployee(form).unwrap();
      setForm(EMPTY_EMPLOYEE_FORM);
    } catch (mutationError) {
      setActionError(getApiErrorMessage(mutationError));
    }
  }

  async function saveRate(employeeId) {
    setActionError('');

    try {
      await updateManagerEmployee({
        employeeId,
        hourlyRateCzk: rateDrafts[employeeId],
      }).unwrap();
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
          <p>{employees.length} active employees</p>
        </div>
      </header>

      <section className="employeesWorkspace">
        <form className="employeesCreate screenCard" onSubmit={submitEmployee}>
          <div className="compactHeader">
            <h2>Add employee</h2>
            <p>Temporary password can be replaced by invitations later.</p>
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

          {actionError ? <p className="statusNote is-error">{actionError}</p> : null}

          <button className="employeesPrimaryButton" type="submit" disabled={isMutating}>
            Add employee
          </button>
        </form>

        <section className="employeesPanel screenCard">
          <div className="compactHeader">
            <h2>Employee list</h2>
            <p>{data?.week ? `${data.week.weekStart} - ${data.week.weekEnd}` : 'Current week'}</p>
          </div>

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
              {employees.map(employee => (
                <article className="employeeCard" key={employee.id}>
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
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => saveRate(employee.id)}
                    >
                      Save
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </section>
  );
}
