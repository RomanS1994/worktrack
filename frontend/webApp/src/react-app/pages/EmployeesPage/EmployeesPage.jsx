import { useState } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useCreateManagerEmployeeMutation,
  useDeleteManagerEmployeeMutation,
  useGetManagerEmployeesQuery,
  useGetDeletedManagerEmployeesQuery,
  useRestoreManagerEmployeeMutation,
  useResetManagerEmployeePasswordMutation,
  useUpdateManagerEmployeeMutation,
} from '../../features/worktrack/worktrackApi.js';
import { getLocalDateKey } from '../../app/formatters.js';
import './EmployeesPage.css';
import './EmployeeSettings.css';

const EMPTY_EMPLOYEE_FORM = { firstName: '', lastName: '', email: '', temporaryPassword: '', hourlyRateCzk: '', customerRateCzk: '' };
const EMPTY_EMPLOYEES = [];
const ACCESS_COPY = {
  uk: { access:'Доступ', employeeCabinet:'Кабінет працівника', managerCabinet:'Кабінет менеджера', managerBadge:'Менеджер', enabled:'Доступ відкрито', disabled:'Доступ вимкнено', grant:'Відкрити доступ', revoke:'Вимкнути доступ', employeeGranted:'Доступ до кабінету працівника відкрито.', employeeRevoked:'Доступ до кабінету працівника вимкнено.', managerGranted:'Доступ до кабінету менеджера відкрито.', managerRevoked:'Доступ до кабінету менеджера вимкнено.' },
  cs: { access:'Přístup', employeeCabinet:'Kabinet pracovníka', managerCabinet:'Kabinet manažera', managerBadge:'Manažer', enabled:'Přístup povolen', disabled:'Přístup vypnut', grant:'Povolit přístup', revoke:'Vypnout přístup', employeeGranted:'Přístup do kabinetu pracovníka byl povolen.', employeeRevoked:'Přístup do kabinetu pracovníka byl vypnut.', managerGranted:'Přístup do kabinetu manažera byl povolen.', managerRevoked:'Přístup do kabinetu manažera byl vypnut.' },
  en: { access:'Access', employeeCabinet:'Employee cabinet', managerCabinet:'Manager cabinet', managerBadge:'Manager', enabled:'Access enabled', disabled:'Access disabled', grant:'Grant access', revoke:'Disable access', employeeGranted:'Employee cabinet access enabled.', employeeRevoked:'Employee cabinet access disabled.', managerGranted:'Manager cabinet access enabled.', managerRevoked:'Manager cabinet access disabled.' },
};

const SETTINGS_COPY = {
 uk: { effective:'Діє з', historyTitle:'Історія ставок', retro:'Записи годин від вибраної дати до наступної зміни ставки буде перераховано. Створені фактури залишаться без змін.', scheduled:'Нову ставку буде застосовано з вибраної дати.', dateHint:'Змініть дату, щоб додати або виправити ставку за інший період.', title:'Налаштування працівника', rates:'Ставки', worker:'Працівнику', customer:'Від замовника', unit:'Kč/год', save:'Зберегти зміни', access:'Доступ до кабінетів', on:'Увімкнено', off:'Вимкнено', management:'Керування', history:'Історія годин і виплат збережеться', archive:'Архівування', archiveHint:'Приховати працівника зі списку, зберігши історію', saved:'Зміни збережено' },
 cs: { effective:'Platí od', historyTitle:'Historie sazeb', retro:'Hodinové záznamy od vybraného data do další změny sazby budou přepočítány. Vytvořené faktury se nezmění.', scheduled:'Nová sazba bude platit od vybraného data.', dateHint:'Změnou data přidáte nebo upravíte sazbu pro jiné období.', title:'Nastavení zaměstnance', rates:'Sazby', worker:'Zaměstnanci', customer:'Od zákazníka', unit:'Kč/h', save:'Uložit změny', access:'Přístup do kabinetů', on:'Zapnuto', off:'Vypnuto', management:'Správa', history:'Historie hodin a plateb zůstane zachována', archive:'Archivace', archiveHint:'Skrýt zaměstnance v seznamu a zachovat historii', saved:'Změny uloženy' },
 en: { effective:'Effective from', historyTitle:'Rate history', retro:'Hour records from this date until the next rate change will be recalculated. Existing invoices remain unchanged.', scheduled:'The new rate will apply from the selected date.', dateHint:'Change the date to add or correct rates for another period.', title:'Employee settings', rates:'Hourly rates', worker:'Employee pay', customer:'Customer rate', unit:'CZK/h', save:'Save changes', access:'Cabinet access', on:'Enabled', off:'Disabled', management:'Management', history:'Hours and payment history will be preserved', archive:'Archive', archiveHint:'Hide employee from the list and preserve history', saved:'Changes saved' },
};

function getEmployeeName(employee, fallback) { return employee?.name || employee?.email || fallback; }
function getEmployeeAvatar(employee) { return employee?.avatarDataUrl || employee?.user?.avatarDataUrl || ''; }
function formatHours(value) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours)) return '0';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(hours);
}

export function EmployeesPage() {
  const { language, t } = useI18n();
  const ac = ACCESS_COPY[language] || ACCESS_COPY.uk;
  const settings = SETTINGS_COPY[language] || SETTINGS_COPY.uk;
  const { data, error, isLoading } = useGetManagerEmployeesQuery();
  const [showArchived, setShowArchived] = useState(false);
  const { data: archivedData, isFetching: archivedLoading, error: archivedError } = useGetDeletedManagerEmployeesQuery(undefined, { skip: !showArchived });
  const [restoreManagerEmployee, restoreState] = useRestoreManagerEmployeeMutation();
  const archivedEmployees = archivedData?.employees || [];
  async function restoreArchivedEmployee(employeeId) {
    clearMessages();
    try {
      await restoreManagerEmployee(employeeId).unwrap();
      setActionSuccess(language === 'cs' ? 'Pracovník obnoven. Historie hodin a plateb zůstala zachována.' : language === 'en' ? 'Employee restored with their existing hours and payment history.' : 'Працівника відновлено зі старою історією годин і виплат.');
    } catch (error) { setActionError(getApiErrorMessage(error)); }
  }
  const [createManagerEmployee, createState] = useCreateManagerEmployeeMutation();
  const [updateManagerEmployee, updateState] = useUpdateManagerEmployeeMutation();
  const [deleteManagerEmployee, deleteState] = useDeleteManagerEmployeeMutation();
  const [resetManagerEmployeePassword, resetState] = useResetManagerEmployeePasswordMutation();
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [modal, setModal] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(getLocalDateKey);
  const [rateDateChanged, setRateDateChanged] = useState(false);
  const [rateBase, setRateBase] = useState({ pay:0, customer:0 });
  const [rateSaved, setRateSaved] = useState(false);
  const [rateDraft, setRateDraft] = useState('');
  const [customerRateDraft, setCustomerRateDraft] = useState('');
  const [employeeAccessDraft, setEmployeeAccessDraft] = useState(true);
  const [managerAccessDraft, setManagerAccessDraft] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const employees = Array.isArray(data?.employees) ? data.employees : EMPTY_EMPLOYEES;
  const activeEmployeeCount = employees.filter(employee => employee.status === 'ACTIVE').length;
  const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId) || null;
  const isMutating = createState.isLoading || updateState.isLoading || deleteState.isLoading || resetState.isLoading;
  const hasEmployeeList = !isLoading && !error;
  const numericRateDraft = Number(rateDraft);
  const numericCustomerRateDraft = Number(customerRateDraft);
  const hasValidRateDraft = rateDraft !== '' && Number.isFinite(numericRateDraft) && numericRateDraft >= 0;
  const hasValidCustomerRateDraft = customerRateDraft !== '' && Number.isFinite(numericCustomerRateDraft) && numericCustomerRateDraft >= 0;

  function clearMessages(){setActionError('');setActionSuccess('')}
  function updateForm(field,value){setForm(current=>({...current,[field]:value}))}
  function openManage(employee){clearMessages();setEffectiveFrom(getLocalDateKey());setRateDateChanged(false);setRateSaved(false);setRateBase({pay:Number(employee.hourlyRateCzk||0),customer:Number(employee.customerRateCzk??employee.hourlyRateCzk??0)});setSelectedEmployeeId(employee.id);setRateDraft(employee.hourlyRateCzk || '0.00');setCustomerRateDraft(employee.customerRateCzk || employee.hourlyRateCzk || '0.00');setEmployeeAccessDraft(employee.canAccessEmployeeCabinet !== false);setManagerAccessDraft(Boolean(employee.canAccessManagerCabinet ?? employee.role === 'MANAGER'));setResetPassword('');setModal('manage')}
  function openAddEmployee(){setForm(EMPTY_EMPLOYEE_FORM);clearMessages();setModal('add')}
  function closeModal(){if(deleteState.isLoading)return;setModal('');setResetPassword('');setActionError('')}

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

  const ratesChanged = !rateSaved && (rateDateChanged || Number(rateDraft) !== rateBase.pay || Number(customerRateDraft) !== rateBase.customer);
  const settingsChanged = selectedEmployee && (ratesChanged || employeeAccessDraft !== (selectedEmployee.canAccessEmployeeCabinet !== false) || managerAccessDraft !== Boolean(selectedEmployee.canAccessManagerCabinet ?? selectedEmployee.role === 'MANAGER'));

  async function saveRate(){
    if(!selectedEmployee||!hasValidRateDraft||!hasValidCustomerRateDraft)return;
    clearMessages();
    try{
      await updateManagerEmployee({employeeId:selectedEmployee.id,...(ratesChanged ? {hourlyRateCzk:rateDraft,customerRateCzk:customerRateDraft,effectiveFrom} : {}),canAccessEmployeeCabinet:employeeAccessDraft,canAccessManagerCabinet:managerAccessDraft}).unwrap();
      setRateSaved(true);setRateDateChanged(false);
      setActionSuccess(settings.saved);
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

  async function confirmDeleteEmployee(){
    if(!selectedEmployee)return;
    const employeeName=getEmployeeName(selectedEmployee,t('employees.employee'));
    setActionError('');
    try{
      await deleteManagerEmployee(selectedEmployee.id).unwrap();
      setSelectedEmployeeId('');
      setModal('');
      setActionSuccess(t('employees.deleted',{name:employeeName}));
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

  const modalTitle=modal==='add'
    ?t('employees.addEmployee')
    :modal==='password'
      ?t('employees.resetPassword')
      :modal==='delete'
        ?t('employees.deleteEmployee')
        :settings.title;

  return <section className="employeesPage pageStack">
    <header className="employeesHeader appTop">
      <div className="appTitleBlock">
        <p className="sectionEyebrow">{t('employees.team')}</p>
        <h1>{t('employees.title')}</h1>
        {hasEmployeeList?<p>{activeEmployeeCount} {t('employees.active')} · {employees.length} {t('employees.total')}</p>:null}
      </div>
    </header>

    {actionSuccess?<p className="statusNote is-success">{actionSuccess}</p>:null}

    <section className="employeesPanel">
      <div className="employeesPanelHeader">
        <div>
          <h2>{t('employees.title')}</h2>
          {hasEmployeeList?<span>{activeEmployeeCount} {t('employees.active')} · {employees.length} {t('employees.total')}</span>:null}
        </div>
        <button type="button" onClick={openAddEmployee}>+ {t('employees.addEmployee')}</button>
      </div>

      {isLoading?<RequestLoadingState label={t('employees.loading')}/>:null}
      {error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
      {hasEmployeeList&&!employees.length?<div className="employeesEmpty"><span aria-hidden="true"><SvgIcon name="accounts"/></span><strong>{t('employees.none')}</strong></div>:null}

      {hasEmployeeList&&employees.length?<div className="employeesList">{employees.map(employee=>{
        const isActive=employee.status==='ACTIVE';
        const avatar=getEmployeeAvatar(employee);
        const employeeName=getEmployeeName(employee,t('employees.employee'));
        const managerAccess=Boolean(employee.canAccessManagerCabinet ?? employee.role==='MANAGER');
        return <button className={`employeeCard${isActive?'':' is-inactive'}`} type="button" key={employee.id} onClick={()=>openManage(employee)}>
          <span className={`employeeCard-avatar${avatar?' has-photo':''}`}>{avatar?<img src={avatar} alt=""/>:employeeName.slice(0,1).toUpperCase()}</span>
          <span className="employeeCard-content">
            <span className="employeeCard-titleRow">
              <strong className="employeeCard-name">{employeeName}</strong>
            </span>
            <span className="employeeCard-email">{employee.email}</span>
            {managerAccess?<em className="employeeCard-role">{ac.managerBadge}</em>:null}
          </span>
          <span className="employeeCard-chevron" aria-hidden="true">›</span>
        </button>
      })}</div>:null}
    </section>

    <section className="employeesPanel">
      <div className="employeesPanelHeader">
        <div><h2>{language === 'cs' ? 'Archivovaní pracovníci' : language === 'en' ? 'Archived employees' : 'Видалені працівники'}</h2></div>
        <button type="button" onClick={() => setShowArchived(value => !value)}>{showArchived ? (language === 'cs' ? 'Skrýt' : language === 'en' ? 'Hide' : 'Сховати') : (language === 'cs' ? 'Zobrazit' : language === 'en' ? 'Show' : 'Показати')}</button>
      </div>
      {showArchived ? <div className="employeesList">
        {archivedLoading ? <RequestLoadingState label={t('employees.loading')}/> : null}
        {archivedError ? <p className="statusNote is-error">{getApiErrorMessage(archivedError)}</p> : null}
        {!archivedLoading && !archivedError && !archivedEmployees.length ? <p className="employeesModalCopy">{language === 'cs' ? 'Žádní archivovaní pracovníci.' : language === 'en' ? 'No archived employees.' : 'Немає видалених працівників.'}</p> : null}
        {archivedEmployees.map(employee => <div className="employeeCard" key={employee.id}>
          <span className="employeeCard-content"><strong className="employeeCard-name">{employee.name}</strong>
          <span className="employeeCard-email">{new Date(employee.deletedAt).toLocaleDateString(language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA')} · {employee.workEntryCount + employee.managerEntryCount} {language === 'cs' ? 'záznamů hodin' : language === 'en' ? 'hour records' : 'записів годин'}</span></span>
          <button type="button" className="employeesPrimaryButton" disabled={restoreState.isLoading} onClick={() => restoreArchivedEmployee(employee.id)}>{language === 'cs' ? 'Obnovit' : language === 'en' ? 'Restore' : 'Відновити'}</button>
        </div>)}
      </div> : null}
    </section>
    {actionError && !modal ? <p className="statusNote is-error">{actionError}</p> : null}

    {modal?<div className="employeesModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal()}}><section className={`employeesModal${modal==='manage'?' is-drawer':''}`} role="dialog" aria-modal="true"><header><div>{modal!=='manage'?<span>{t('employees.team')}</span>:null}<h2>{modalTitle}</h2></div><button type="button" aria-label={t('employees.close')} onClick={closeModal}>×</button></header>
      {modal==='add'?<form className="employeesModalBody" onSubmit={submitEmployee}><p className="employeesModalCopy">{t('employees.addCopy')}</p><div className="employeesFormGrid"><label className="employeesField"><span>{t('employees.firstName')}</span><input type="text" value={form.firstName} onChange={e=>updateForm('firstName',e.target.value)} required/></label><label className="employeesField"><span>{t('employees.lastName')}</span><input type="text" value={form.lastName} onChange={e=>updateForm('lastName',e.target.value)} required/></label></div><label className="employeesField"><span>{t('employees.email')}</span><input type="email" value={form.email} onChange={e=>updateForm('email',e.target.value)} required/></label><label className="employeesField"><span>{t('employees.temporaryPassword')}</span><input type="password" minLength={8} value={form.temporaryPassword} onChange={e=>updateForm('temporaryPassword',e.target.value)} required/></label><div className="employeesFormGrid"><label className="employeesField"><span>{t('employees.hourlyRate')}</span><small>{t('employees.hourlyRateHint')}</small><input inputMode="decimal" type="number" min="0" step="0.01" value={form.hourlyRateCzk} onChange={e=>updateForm('hourlyRateCzk',e.target.value)} required/></label><label className="employeesField"><span>{t('employees.customerRate')}</span><small>{t('employees.customerRateHint')}</small><input inputMode="decimal" type="number" min="0" step="0.01" value={form.customerRateCzk} onChange={e=>updateForm('customerRateCzk',e.target.value)}/></label></div>{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="employeesPrimaryButton" disabled={isMutating}>{t('employees.addEmployee')}</button></form>:null}
      {modal==='manage'&&selectedEmployee?<>
        <div className="employeesModalBody employeeSettingsBody">
          <section className="employeeDetailHero">
            <span className={`employeeDetailAvatar${getEmployeeAvatar(selectedEmployee)?' has-photo':''}`}>{getEmployeeAvatar(selectedEmployee)?<img src={getEmployeeAvatar(selectedEmployee)} alt=""/>:getEmployeeName(selectedEmployee,t('employees.employee')).slice(0,1).toUpperCase()}</span>
            <div><strong>{getEmployeeName(selectedEmployee,t('employees.employee'))}</strong><p>{selectedEmployee.email}</p></div>
            <em className={selectedEmployee.status==='ACTIVE'?'is-active':''}>{selectedEmployee.status==='ACTIVE'?t('employees.activeStatus'):t('employees.inactiveStatus')}</em>
          </section>
          <section className="employeeDetailSection">
            <h3>{settings.rates}</h3>
            <div className="employeeSettingsRates">
              <label className="employeesField"><span>{settings.worker}<details className="employeeSettingsHelp"><summary aria-label={t('employees.hourlyRateHint')}>ⓘ</summary><small>{t('employees.hourlyRateHint')}</small></details></span><div className="employeeSettingsInput"><input aria-label={settings.worker} inputMode="decimal" type="number" min="0" step="0.01" value={rateDraft} onChange={e=>{setRateDraft(e.target.value);setRateSaved(false)}}/><span>{settings.unit}</span></div></label>
              <label className="employeesField"><span>{settings.customer}<details className="employeeSettingsHelp"><summary aria-label={t('employees.customerRateHint')}>ⓘ</summary><small>{t('employees.customerRateHint')}</small></details></span><div className="employeeSettingsInput"><input aria-label={settings.customer} inputMode="decimal" type="number" min="0" step="0.01" value={customerRateDraft} onChange={e=>{setCustomerRateDraft(e.target.value);setRateSaved(false)}}/><span>{settings.unit}</span></div></label>
            </div>
            <label className="employeesField"><span>{settings.effective}</span><input type="date" required value={effectiveFrom} onChange={event=>{setEffectiveFrom(event.target.value);setRateDateChanged(true);setRateSaved(false)}}/></label>
            <p className="employeeSettingsDateNote">{settings.dateHint}</p>
            {ratesChanged && effectiveFrom ? <p className="employeeSettingsRateNotice" role="status">{effectiveFrom <= getLocalDateKey() ? settings.retro : settings.scheduled}</p> : null}
            {selectedEmployee.rateHistory?.length ? <details className="employeeSettingsRateHistory"><summary>{settings.historyTitle}</summary>{[...selectedEmployee.rateHistory].sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)).map(item=><button type="button" key={item.effectiveFrom} onClick={()=>{setEffectiveFrom(item.effectiveFrom);setRateDraft(item.hourlyRateCzk);setCustomerRateDraft(item.customerRateCzk);setRateDateChanged(true);setRateSaved(false)}}><span>{item.effectiveFrom.split('-').reverse().join('.')}</span><strong>{item.hourlyRateCzk} → {item.customerRateCzk} {settings.unit}</strong></button>)}</details> : null}
          </section>
          <section className="employeeDetailSection"><h3>{settings.access}</h3><div className="employeeSettingsGroup">
            {[[ac.employeeCabinet,employeeAccessDraft,setEmployeeAccessDraft,'user'],[ac.managerCabinet,managerAccessDraft,setManagerAccessDraft,'users']].map(([label,enabled,setEnabled,icon])=><button key={label} type="button" className="employeeSettingsAccess" role="switch" aria-checked={enabled} aria-label={label} disabled={isMutating} onClick={()=>setEnabled(value=>!value)}><SvgIcon name={icon}/><span>{label}<small>{enabled?settings.on:settings.off}</small></span><i className={enabled?'is-on':''} aria-hidden="true"/></button>)}
          </div></section>
          {actionError?<p className="statusNote is-error" role="alert">{actionError}</p>:null}
          {actionSuccess?<p className="statusNote is-success" role="status">{actionSuccess}</p>:null}
          <section className="employeeDetailSection"><h3>{settings.management}</h3><div className="employeeSettingsGroup">
            <button className="employeeSettingsAction" type="button" disabled={isMutating} onClick={()=>{setResetPassword('');setModal('password')}}><SvgIcon name="lock"/><span>{t('employees.resetPassword')}</span><b aria-hidden="true">›</b></button>
            <button className={`employeeSettingsAction ${selectedEmployee.status==='ACTIVE'?'is-danger':'is-success'}`} type="button" disabled={isMutating} onClick={toggleEmployeeStatus}><SvgIcon name="user"/><span>{selectedEmployee.status==='ACTIVE'?t('employees.deactivate'):t('employees.reactivate')}<small>{settings.history}</small></span><b aria-hidden="true">›</b></button>
          </div></section>
          <details className="employeeSettingsArchive"><summary>{settings.archive}</summary><p>{settings.archiveHint}</p><button className="employeeSettingsAction is-danger" type="button" disabled={isMutating||Boolean(selectedEmployee.canAccessManagerCabinet ?? selectedEmployee.role==='MANAGER')} onClick={()=>{setActionError('');setModal('delete')}}><SvgIcon name="trash"/><span>{t('employees.deleteEmployee')}</span><b aria-hidden="true">›</b></button></details>
        </div>
        <footer className="employeeSettingsFooter"><button className="employeesPrimaryButton" type="button" disabled={isMutating||!hasValidRateDraft||!hasValidCustomerRateDraft||!effectiveFrom||!settingsChanged} onClick={saveRate}>{settings.save}</button></footer>
      </>:null}
      {modal==='password'&&selectedEmployee?<form className="employeesModalBody" onSubmit={submitPasswordReset}><p className="employeesModalCopy">{t('employees.resetCopy')}</p><label className="employeesField"><span>{t('employees.newTemporaryPassword')}</span><input type="password" minLength={8} value={resetPassword} placeholder={t('employees.minPlaceholder')} onChange={e=>setResetPassword(e.target.value)} required/></label>{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="employeesPrimaryButton" disabled={isMutating||resetPassword.length<8}>{t('employees.setTemporaryPassword')}</button><button className="employeesCancelButton" type="button" onClick={()=>setModal('manage')}>{t('employees.cancel')}</button></form>:null}
      {modal==='delete'&&selectedEmployee?<div className="employeesModalBody"><p className="employeesModalCopy">{t('employees.deleteCopy',{name:getEmployeeName(selectedEmployee,t('employees.employee'))})}</p><p className="employeesDeleteWarning">{t('employees.deleteWarning')}</p>{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="employeesDangerButton" type="button" disabled={deleteState.isLoading} onClick={confirmDeleteEmployee}>{deleteState.isLoading?t('employees.deleting'):t('employees.confirmDelete')}</button><button className="employeesCancelButton" type="button" disabled={deleteState.isLoading} onClick={()=>{setActionError('');setModal('manage')}}>{t('employees.cancel')}</button></div>:null}
    </section></div>:null}
  </section>;
}
