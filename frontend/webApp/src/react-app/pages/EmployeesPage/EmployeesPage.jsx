import { useState } from 'react';

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
const EMPTY_EMPLOYEES = [];

function getEmployeeName(employee, fallback) { return employee?.name || employee?.email || fallback; }

export function EmployeesPage() {
  const { t } = useI18n();
  const { data, error, isLoading } = useGetManagerEmployeesQuery();
  const [createManagerEmployee, createState] = useCreateManagerEmployeeMutation();
  const [updateManagerEmployee, updateState] = useUpdateManagerEmployeeMutation();
  const [resetManagerEmployeePassword, resetState] = useResetManagerEmployeePasswordMutation();
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [modal, setModal] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [rateDraft, setRateDraft] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const employees = Array.isArray(data?.employees) ? data.employees : EMPTY_EMPLOYEES;
  const activeEmployeeCount = employees.filter(employee => employee.status === 'ACTIVE').length;
  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId) || null;
  const isMutating = createState.isLoading || updateState.isLoading || resetState.isLoading;
  const hasEmployeeList = !isLoading && !error;
  const numericRateDraft = Number(rateDraft);
  const hasValidRateDraft = rateDraft !== '' && Number.isFinite(numericRateDraft) && numericRateDraft >= 0;

  function clearMessages(){setActionError('');setActionSuccess('')}
  function updateForm(field,value){setForm(current=>({...current,[field]:value}))}
  function openManage(employee){clearMessages();setSelectedEmployeeId(employee.id);setRateDraft(employee.hourlyRateCzk || '0.00');setResetPassword('');setModal('manage')}
  function closeModal(){setModal('');setResetPassword('');setActionError('')}

  async function submitEmployee(event){
    event.preventDefault();
    clearMessages();
    try{
      await createManagerEmployee(form).unwrap();
      setForm(EMPTY_EMPLOYEE_FORM);
      setActionSuccess(t('employees.employeeAdded'));
      setModal('');
    }catch(e){setActionError(getApiErrorMessage(e))}
  }

  async function saveRate(){
    if(!selectedEmployee||!hasValidRateDraft)return;
    clearMessages();
    try{
      await updateManagerEmployee({employeeId:selectedEmployee.id,hourlyRateCzk:rateDraft}).unwrap();
      setActionSuccess(t('employees.rateUpdated'));
    }catch(e){setActionError(getApiErrorMessage(e))}
  }

  async function toggleEmployeeStatus(){
    if(!selectedEmployee)return;
    clearMessages();
    const nextStatus=selectedEmployee.status==='ACTIVE'?'INACTIVE':'ACTIVE';
    try{
      await updateManagerEmployee({employeeId:selectedEmployee.id,status:nextStatus}).unwrap();
      setActionSuccess(nextStatus==='ACTIVE'?t('employees.reactivated'):t('employees.deactivated'));
    }catch(e){setActionError(getApiErrorMessage(e))}
  }

  async function submitPasswordReset(event){
    event.preventDefault();
    if(!selectedEmployee)return;
    clearMessages();
    if(resetPassword.length<8){setActionError(t('employees.passwordMin'));return}
    try{
      await resetManagerEmployeePassword({employeeId:selectedEmployee.id,temporaryPassword:resetPassword}).unwrap();
      setResetPassword('');
      setActionSuccess(t('employees.passwordReset',{name:getEmployeeName(selectedEmployee,t('employees.employee'))}));
      setModal('manage');
    }catch(e){setActionError(getApiErrorMessage(e))}
  }

  return <section className="employeesPage pageStack">
    <header className="employeesHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('employees.team')}</p><h1>{t('employees.title')}</h1>{hasEmployeeList?<p>{activeEmployeeCount} {t('employees.active')} · {employees.length} {t('employees.total')}</p>:null}</div><button className="employeesAddTop" type="button" onClick={()=>{setForm(EMPTY_EMPLOYEE_FORM);clearMessages();setModal('add')}}>+ {t('employees.addEmployee')}</button></header>
    {actionSuccess?<p className="statusNote is-success">{actionSuccess}</p>:null}
    <section className="employeesPanel screenCard"><div className="compactHeader"><h2>{t('employees.list')}</h2>{hasEmployeeList?<p>{data?.week?`${data.week.weekStart} - ${data.week.weekEnd}`:t('employees.currentWeek')}</p>:null}</div>{isLoading?<RequestLoadingState label={t('employees.loading')}/>:null}{error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}{hasEmployeeList&&!employees.length?<div className="employeesEmpty"><span aria-hidden="true"><SvgIcon name="accounts"/></span><strong>{t('employees.none')}</strong></div>:null}
      {hasEmployeeList&&employees.length?<div className="employeesList">{employees.map(employee=>{const isActive=employee.status==='ACTIVE';return <button className={`employeeCard${isActive?'':' is-inactive'}`} type="button" key={employee.id} onClick={()=>openManage(employee)}><div className="employeeCard-main"><span className="employeeCard-avatar">{getEmployeeName(employee,t('employees.employee')).slice(0,1).toUpperCase()}</span><div><strong>{getEmployeeName(employee,t('employees.employee'))}</strong><p>{employee.email}</p></div></div><div className="employeeCard-metrics"><span><strong>{employee.summary?.totalHours||'0.00'} h</strong><em>{t('employees.week')}</em></span><span><strong>{employee.pendingSubmissions||0}</strong><em>{t('employees.pending')}</em></span><span><strong>{isActive?t('employees.activeStatus'):t('employees.inactiveStatus')}</strong><em>{t('employees.status')}</em></span></div><span className="employeeCard-chevron">›</span></button>})}</div>:null}
    </section>

    {modal?<div className="employeesModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal()}}><section className={`employeesModal${modal==='manage'?' is-drawer':''}`} role="dialog" aria-modal="true"><header><div><span>{t('employees.team')}</span><h2>{modal==='add'?t('employees.addEmployee'):modal==='password'?t('employees.resetPassword'):getEmployeeName(selectedEmployee,t('employees.employee'))}</h2></div><button type="button" aria-label={t('employees.close')} onClick={closeModal}>×</button></header>
      {modal==='add'?<form className="employeesModalBody" onSubmit={submitEmployee}><p className="employeesModalCopy">{t('employees.addCopy')}</p><div className="employeesFormGrid"><label className="employeesField"><span>{t('employees.firstName')}</span><input type="text" value={form.firstName} onChange={e=>updateForm('firstName',e.target.value)} required/></label><label className="employeesField"><span>{t('employees.lastName')}</span><input type="text" value={form.lastName} onChange={e=>updateForm('lastName',e.target.value)} required/></label></div><label className="employeesField"><span>{t('employees.email')}</span><input type="email" value={form.email} onChange={e=>updateForm('email',e.target.value)} required/></label><div className="employeesFormGrid"><label className="employeesField"><span>{t('employees.temporaryPassword')}</span><input type="password" minLength={8} value={form.temporaryPassword} onChange={e=>updateForm('temporaryPassword',e.target.value)} required/></label><label className="employeesField"><span>{t('employees.hourlyRate')}</span><input inputMode="decimal" type="number" min="0" step="0.01" value={form.hourlyRateCzk} onChange={e=>updateForm('hourlyRateCzk',e.target.value)} required/></label></div>{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="employeesPrimaryButton" disabled={isMutating}>{t('employees.addEmployee')}</button></form>:null}
      {modal==='manage'&&selectedEmployee?<div className="employeesModalBody"><section className="employeeDetailHero"><span className="employeeDetailAvatar">{getEmployeeName(selectedEmployee,t('employees.employee')).slice(0,1).toUpperCase()}</span><div><strong>{getEmployeeName(selectedEmployee,t('employees.employee'))}</strong><p>{selectedEmployee.email}</p></div><em className={selectedEmployee.status==='ACTIVE'?'is-active':''}>{selectedEmployee.status==='ACTIVE'?t('employees.activeStatus'):t('employees.inactiveStatus')}</em></section><section className="employeeDetailStats"><div><strong>{selectedEmployee.summary?.totalHours||'0.00'} h</strong><span>{t('employees.week')}</span></div><div><strong>{selectedEmployee.pendingSubmissions||0}</strong><span>{t('employees.pending')}</span></div></section><section className="employeeDetailSection"><h3>{t('employees.employeeDetails')}</h3><label className="employeesField"><span>{t('employees.rate')}</span><div className="employeeRateRow"><input inputMode="decimal" type="number" min="0" step="0.01" value={rateDraft} onChange={e=>setRateDraft(e.target.value)}/><button type="button" disabled={isMutating||!hasValidRateDraft} onClick={saveRate}>{t('employees.saveRate')}</button></div></label></section>{actionError?<p className="statusNote is-error">{actionError}</p>:null}{actionSuccess?<p className="statusNote is-success">{actionSuccess}</p>:null}<section className="employeeDetailSection"><h3>{t('employees.actions')}</h3><button className="employeeAction" type="button" onClick={()=>{setResetPassword('');setModal('password')}}>{t('employees.resetPassword')}<span>›</span></button><button className={`employeeAction ${selectedEmployee.status==='ACTIVE'?'is-danger':'is-success'}`} type="button" disabled={isMutating} onClick={toggleEmployeeStatus}>{selectedEmployee.status==='ACTIVE'?t('employees.deactivate'):t('employees.reactivate')}<span>›</span></button></section></div>:null}
      {modal==='password'&&selectedEmployee?<form className="employeesModalBody" onSubmit={submitPasswordReset}><p className="employeesModalCopy">{t('employees.resetCopy')}</p><label className="employeesField"><span>{t('employees.newTemporaryPassword')}</span><input type="password" minLength={8} value={resetPassword} placeholder={t('employees.minPlaceholder')} onChange={e=>setResetPassword(e.target.value)} required/></label>{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="employeesPrimaryButton" disabled={isMutating||resetPassword.length<8}>{t('employees.setTemporaryPassword')}</button><button className="employeesCancelButton" type="button" onClick={()=>setModal('manage')}>{t('employees.cancel')}</button></form>:null}
    </section></div>:null}
  </section>;
}
