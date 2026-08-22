import { useEffect, useRef, useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateManagerEmployeeMutation,
  useGetManagerEmployeesQuery,
  useResetManagerEmployeePasswordMutation,
  useUpdateManagerEmployeeMutation,
} from '../../features/worktrack/worktrackApi.js';
import './EmployeesPage.css';

const EMPTY_EMPLOYEE_FORM = { firstName: '', lastName: '', email: '', temporaryPassword: '', hourlyRateCzk: '' };
const TEXT = {
  uk: {
    employee: 'Працівник', team: 'Команда', title: 'Працівники', active: 'активних', total: 'всього', addEmployee: 'Додати працівника', addCopy: 'Працівник повинен змінити тимчасовий пароль після першого входу.', firstName: 'Ім’я', lastName: 'Прізвище', email: 'E-mail', temporaryPassword: 'Тимчасовий пароль', hourlyRate: 'Погодинна ставка CZK', employeeAdded: 'Працівника додано. Передайте тимчасовий пароль безпечним способом.', rateUpdated: 'Погодинну ставку оновлено.', reactivated: 'Працівника знову активовано.', deactivated: 'Працівника деактивовано.', passwordMin: 'Тимчасовий пароль має містити щонайменше 8 символів.', passwordReset: 'Пароль скинуто для {name}. Усі активні сесії завершено.', list: 'Список працівників', currentWeek: 'Поточний тиждень', loading: 'Завантаження працівників', none: 'Працівників ще немає', week: 'тиждень', pending: 'очікує', status: 'статус', rate: 'Ставка CZK', saveRate: 'Зберегти ставку', deactivate: 'Деактивувати', reactivate: 'Активувати', cancelReset: 'Скасувати скидання', resetPassword: 'Скинути пароль', newTemporaryPassword: 'Новий тимчасовий пароль', minPlaceholder: 'Щонайменше 8 символів', resetCopy: 'Активні сесії буде завершено. Працівник повинен змінити цей пароль після входу.', setTemporaryPassword: 'Встановити тимчасовий пароль', activeStatus: 'Активний', inactiveStatus: 'Неактивний'
  },
  en: {
    employee: 'Employee', team: 'Team', title: 'Employees', active: 'active', total: 'total', addEmployee: 'Add employee', addCopy: 'The employee must replace the temporary password after the first sign in.', firstName: 'First name', lastName: 'Last name', email: 'Email', temporaryPassword: 'Temporary password', hourlyRate: 'Hourly rate CZK', employeeAdded: 'Employee added. Share the temporary password securely.', rateUpdated: 'Hourly rate updated.', reactivated: 'Employee reactivated.', deactivated: 'Employee deactivated.', passwordMin: 'Temporary password must be at least 8 characters long.', passwordReset: 'Password reset for {name}. Their existing sessions were signed out.', list: 'Employee list', currentWeek: 'Current week', loading: 'Loading employees', none: 'No employees yet', week: 'week', pending: 'pending', status: 'status', rate: 'Rate CZK', saveRate: 'Save rate', deactivate: 'Deactivate', reactivate: 'Reactivate', cancelReset: 'Cancel reset', resetPassword: 'Reset password', newTemporaryPassword: 'New temporary password', minPlaceholder: 'At least 8 characters', resetCopy: 'Existing sessions will be signed out. The employee must change this password after signing in.', setTemporaryPassword: 'Set temporary password', activeStatus: 'Active', inactiveStatus: 'Inactive'
  },
  cs: {
    employee: 'Zaměstnanec', team: 'Tým', title: 'Zaměstnanci', active: 'aktivních', total: 'celkem', addEmployee: 'Přidat zaměstnance', addCopy: 'Zaměstnanec musí po prvním přihlášení změnit dočasné heslo.', firstName: 'Jméno', lastName: 'Příjmení', email: 'E-mail', temporaryPassword: 'Dočasné heslo', hourlyRate: 'Hodinová sazba CZK', employeeAdded: 'Zaměstnanec byl přidán. Dočasné heslo předejte bezpečným způsobem.', rateUpdated: 'Hodinová sazba byla aktualizována.', reactivated: 'Zaměstnanec byl znovu aktivován.', deactivated: 'Zaměstnanec byl deaktivován.', passwordMin: 'Dočasné heslo musí mít alespoň 8 znaků.', passwordReset: 'Heslo pro {name} bylo resetováno. Všechny aktivní relace byly ukončeny.', list: 'Seznam zaměstnanců', currentWeek: 'Aktuální týden', loading: 'Načítání zaměstnanců', none: 'Zatím žádní zaměstnanci', week: 'týden', pending: 'čeká', status: 'stav', rate: 'Sazba CZK', saveRate: 'Uložit sazbu', deactivate: 'Deaktivovat', reactivate: 'Aktivovat', cancelReset: 'Zrušit reset', resetPassword: 'Resetovat heslo', newTemporaryPassword: 'Nové dočasné heslo', minPlaceholder: 'Alespoň 8 znaků', resetCopy: 'Aktivní relace budou ukončeny. Zaměstnanec musí toto heslo po přihlášení změnit.', setTemporaryPassword: 'Nastavit dočasné heslo', activeStatus: 'Aktivní', inactiveStatus: 'Neaktivní'
  },
};

function getEmployeeName(employee, fallback) {
  return employee?.name || employee?.email || fallback;
}

export function EmployeesPage() {
  const { language } = useI18n();
  const copy = TEXT[language] || TEXT.uk;
  const { data, error, isLoading } = useGetManagerEmployeesQuery();
  const [createManagerEmployee, createState] = useCreateManagerEmployeeMutation();
  const [updateManagerEmployee, updateState] = useUpdateManagerEmployeeMutation();
  const [resetManagerEmployeePassword, resetState] = useResetManagerEmployeePasswordMutation();
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [rateDrafts, setRateDrafts] = useState({});
  const serverRateSnapshotRef = useRef({});
  const [resetEmployeeId, setResetEmployeeId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const activeEmployeeCount = employees.filter(employee => employee.status === 'ACTIVE').length;
  const isMutating = createState.isLoading || updateState.isLoading || resetState.isLoading;
  const hasEmployeeList = !isLoading && !error;

  useEffect(() => {
    const nextServerRates = employees.reduce((next, employee) => {
      next[employee.id] = employee.hourlyRateCzk || '0.00';
      return next;
    }, {});

    setRateDrafts(current => {
      const previousServerRates = serverRateSnapshotRef.current;
      return employees.reduce((next, employee) => {
        const employeeId = employee.id;
        const serverRate = nextServerRates[employeeId];
        const previousServerRate = previousServerRates[employeeId];
        const currentDraft = current[employeeId];
        const hasUnsavedDraft = currentDraft !== undefined
          && previousServerRate !== undefined
          && currentDraft !== previousServerRate;

        next[employeeId] = hasUnsavedDraft ? currentDraft : serverRate;
        return next;
      }, {});
    });

    serverRateSnapshotRef.current = nextServerRates;
  }, [employees]);

  function clearActionMessages() { setActionError(''); setActionSuccess(''); }
  function updateForm(field, value) { setForm(current => ({ ...current, [field]: value })); }

  async function submitEmployee(event) {
    event.preventDefault();
    clearActionMessages();
    try {
      await createManagerEmployee(form).unwrap();
      setForm(EMPTY_EMPLOYEE_FORM);
      setActionSuccess(copy.employeeAdded);
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function saveRate(employeeId) {
    if (!hasEmployeeList) return;
    clearActionMessages();
    try {
      await updateManagerEmployee({ employeeId, hourlyRateCzk: rateDrafts[employeeId] }).unwrap();
      setActionSuccess(copy.rateUpdated);
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function toggleEmployeeStatus(employee) {
    if (!hasEmployeeList) return;
    clearActionMessages();
    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateManagerEmployee({ employeeId: employee.id, status: nextStatus }).unwrap();
      setActionSuccess(nextStatus === 'ACTIVE' ? copy.reactivated : copy.deactivated);
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  function openPasswordReset(employeeId) { clearActionMessages(); setResetPassword(''); setResetEmployeeId(employeeId); }
  function closePasswordReset() { setResetPassword(''); setResetEmployeeId(''); }

  async function submitPasswordReset(employee) {
    if (!hasEmployeeList) return;
    clearActionMessages();
    if (resetPassword.length < 8) { setActionError(copy.passwordMin); return; }
    try {
      await resetManagerEmployeePassword({ employeeId: employee.id, temporaryPassword: resetPassword }).unwrap();
      closePasswordReset();
      setActionSuccess(copy.passwordReset.replace('{name}', getEmployeeName(employee, copy.employee)));
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  return (
    <section className="employeesPage pageStack">
      <header className="employeesHeader appTop">
        <div className="appTitleBlock">
          <p className="sectionEyebrow">{copy.team}</p>
          <h1>{copy.title}</h1>
          {hasEmployeeList ? <p>{activeEmployeeCount} {copy.active} · {employees.length} {copy.total}</p> : null}
        </div>
      </header>

      <section className="employeesWorkspace">
        <form className="employeesCreate screenCard" onSubmit={submitEmployee}>
          <div className="compactHeader"><h2>{copy.addEmployee}</h2><p>{copy.addCopy}</p></div>
          <div className="employeesFormGrid">
            <label className="employeesField"><span>{copy.firstName}</span><input type="text" value={form.firstName} onChange={event => updateForm('firstName', event.target.value)} /></label>
            <label className="employeesField"><span>{copy.lastName}</span><input type="text" value={form.lastName} onChange={event => updateForm('lastName', event.target.value)} /></label>
          </div>
          <label className="employeesField"><span>{copy.email}</span><input type="email" value={form.email} onChange={event => updateForm('email', event.target.value)} /></label>
          <div className="employeesFormGrid">
            <label className="employeesField"><span>{copy.temporaryPassword}</span><input type="password" minLength={8} value={form.temporaryPassword} onChange={event => updateForm('temporaryPassword', event.target.value)} /></label>
            <label className="employeesField"><span>{copy.hourlyRate}</span><input inputMode="decimal" type="number" min="0" step="0.01" value={form.hourlyRateCzk} onChange={event => updateForm('hourlyRateCzk', event.target.value)} /></label>
          </div>
          <button className="employeesPrimaryButton" type="submit" disabled={isMutating}>{copy.addEmployee}</button>
        </form>

        <section className="employeesPanel screenCard">
          <div className="compactHeader"><h2>{copy.list}</h2>{hasEmployeeList ? <p>{data?.week ? `${data.week.weekStart} - ${data.week.weekEnd}` : copy.currentWeek}</p> : null}</div>
          {actionError ? <p className="statusNote is-error">{actionError}</p> : null}
          {actionSuccess ? <p className="statusNote is-success">{actionSuccess}</p> : null}
          {isLoading ? <RequestLoadingState label={copy.loading} /> : null}
          {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
          {hasEmployeeList && !employees.length ? <div className="employeesEmpty"><span aria-hidden="true"><SvgIcon name="accounts" /></span><strong>{copy.none}</strong></div> : null}

          {hasEmployeeList && employees.length ? (
            <div className="employeesList">
              {employees.map(employee => {
                const isActive = employee.status === 'ACTIVE';
                const isResettingPassword = resetEmployeeId === employee.id;
                return (
                  <article className={`employeeCard${isActive ? '' : ' is-inactive'}`} key={employee.id}>
                    <div className="employeeCard-main">
                      <span className="employeeCard-avatar" aria-hidden="true">{getEmployeeName(employee, copy.employee).slice(0, 1).toUpperCase()}</span>
                      <div><strong>{getEmployeeName(employee, copy.employee)}</strong><p>{employee.email}</p></div>
                    </div>
                    <div className="employeeCard-metrics">
                      <span><strong>{employee.summary?.totalHours || '0.00'} h</strong><em>{copy.week}</em></span>
                      <span><strong>{employee.pendingSubmissions || 0}</strong><em>{copy.pending}</em></span>
                      <span><strong>{isActive ? copy.activeStatus : copy.inactiveStatus}</strong><em>{copy.status}</em></span>
                    </div>
                    <div className="employeeRateEditor">
                      <label><span>{copy.rate}</span><input inputMode="decimal" type="number" min="0" step="0.01" value={rateDrafts[employee.id] || ''} onChange={event => setRateDrafts(current => ({ ...current, [employee.id]: event.target.value }))} /></label>
                      <div className="employeeCard-actions">
                        <button type="button" disabled={isMutating} onClick={() => saveRate(employee.id)}>{copy.saveRate}</button>
                        <button className={isActive ? 'is-deactivate' : 'is-activate'} type="button" disabled={isMutating} onClick={() => toggleEmployeeStatus(employee)}>{isActive ? copy.deactivate : copy.reactivate}</button>
                        <button className="is-password-reset" type="button" disabled={isMutating} onClick={() => isResettingPassword ? closePasswordReset() : openPasswordReset(employee.id)}>{isResettingPassword ? copy.cancelReset : copy.resetPassword}</button>
                      </div>
                      {isResettingPassword ? (
                        <div className="employeePasswordReset">
                          <label><span>{copy.newTemporaryPassword}</span><input type="password" minLength={8} autoComplete="new-password" value={resetPassword} placeholder={copy.minPlaceholder} disabled={isMutating} onChange={event => setResetPassword(event.target.value)} /></label>
                          <p>{copy.resetCopy}</p>
                          <button type="button" disabled={isMutating || resetPassword.length < 8} onClick={() => submitPasswordReset(employee)}>{copy.setTemporaryPassword}</button>
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
