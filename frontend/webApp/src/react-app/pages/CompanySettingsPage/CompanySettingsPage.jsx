import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { baseApi } from '@shared/app/api/baseApi.js';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import { useGetCompanyBillingQuery, useUpdateCompanyBillingMutation } from '../../features/worktrack/billingApi.js';
import {
  useGetCompanySettingsQuery,
  useGetWorkRulesQuery,
  useUpdateCompanySettingsMutation,
  useUpdateWorkRulesMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CompanySettingsPage.css';

const BILLING_COPY={
 uk:{title:'Реквізити для фактур',copy:'Ці дані автоматично потрапляють у фактури працівників як реквізити роботодавця.',ico:'IČO',dic:'DIČ / VAT ID',address:'Юридична адреса',email:'Email для фактур',save:'Зберегти реквізити',saving:'Збереження…',saved:'Реквізити збережено'},
 cs:{title:'Fakturační údaje',copy:'Tyto údaje se automaticky použijí na fakturách pracovníků jako údaje odběratele.',ico:'IČO',dic:'DIČ / VAT ID',address:'Fakturační adresa',email:'E-mail pro faktury',save:'Uložit fakturační údaje',saving:'Ukládání…',saved:'Fakturační údaje byly uloženy'},
 en:{title:'Company billing details',copy:'These details are automatically used as the employer/buyer details on employee invoices.',ico:'Company ID (IČO)',dic:'VAT ID (DIČ)',address:'Billing address',email:'Invoice email',save:'Save billing details',saving:'Saving…',saved:'Billing details saved'}
};
const WORK_COPY={
 uk:{title:'Робочий час',copy:'Налаштуйте автоматичне віднімання обіду та денну норму для розрахунку понаднормових.',break:'Автоматична перерва на обід',none:'Не віднімати',min30:'30 хвилин',min60:'60 хвилин',norm:'Нормовані години на день',normHint:'Понаднормові рахуються з чистих годин після віднімання обіду.',example:'Приклад',save:'Зберегти правила',saving:'Збереження…',saved:'Правила робочого часу збережено'},
 cs:{title:'Pracovní doba',copy:'Nastavte automatický odpočet oběda a denní normu pro výpočet přesčasů.',break:'Automatická přestávka na oběd',none:'Neodečítat',min30:'30 minut',min60:'60 minut',norm:'Denní norma hodin',normHint:'Přesčas se počítá z čistých hodin po odečtení přestávky.',example:'Příklad',save:'Uložit pravidla',saving:'Ukládání…',saved:'Pravidla pracovní doby byla uložena'},
 en:{title:'Working time rules',copy:'Configure the automatic lunch deduction and daily standard used for overtime.',break:'Automatic lunch break',none:'No deduction',min30:'30 minutes',min60:'60 minutes',norm:'Standard hours per day',normHint:'Overtime is calculated from net hours after the lunch deduction.',example:'Example',save:'Save work rules',saving:'Saving…',saved:'Working time rules saved'}
};
const emptyBilling={ico:'',dic:'',address:'',email:''};

export function CompanySettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { language, t } = useI18n();
  const bc=BILLING_COPY[language]||BILLING_COPY.uk;
  const wc=WORK_COPY[language]||WORK_COPY.uk;
  const { data, error, isLoading } = useGetCompanySettingsQuery();
  const [updateCompanySettings, updateState] = useUpdateCompanySettingsMutation();
  const {data:workRulesData,error:workRulesError,isLoading:workRulesLoading}=useGetWorkRulesQuery();
  const [updateWorkRules,workRulesUpdateState]=useUpdateWorkRulesMutation();
  const {data:billingData,error:billingError,isLoading:billingLoading}=useGetCompanyBillingQuery();
  const [updateCompanyBilling,billingUpdateState]=useUpdateCompanyBillingMutation();
  const [billing,setBilling]=useState(emptyBilling);
  const [billingMessage,setBillingMessage]=useState('');
  const [billingActionError,setBillingActionError]=useState('');
  const [breakMinutes,setBreakMinutes]=useState('0');
  const [standardDailyHours,setStandardDailyHours]=useState('8.00');
  const [workRulesMessage,setWorkRulesMessage]=useState('');
  const [workRulesActionError,setWorkRulesActionError]=useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const company = data?.company || null;
  const normalizedName = name.trim();
  const hasChanges = useMemo(
    () => Boolean(company && normalizedName && normalizedName !== String(company.name || '').trim()),
    [company, normalizedName],
  );

  useEffect(() => { if (company?.name) setName(company.name); }, [company?.name]);
  useEffect(()=>{if(billingData?.company?.billingProfile)setBilling({...emptyBilling,...billingData.company.billingProfile})},[billingData]);
  useEffect(()=>{if(workRulesData?.workRules){setBreakMinutes(String(workRulesData.workRules.breakMinutes??0));setStandardDailyHours(String(workRulesData.workRules.standardDailyHours??'8.00'))}},[workRulesData]);

  function syncCompanyIntoSession(updatedCompany) {
    if (!user || !token || !updatedCompany?.id) return;
    const nextUser = {
      ...user,
      activeCompany: { ...(user.activeCompany || {}), ...updatedCompany },
      activeMembership: user.activeMembership ? { ...user.activeMembership, company: { ...(user.activeMembership.company || {}), ...updatedCompany } } : user.activeMembership,
      memberships: Array.isArray(user.memberships) ? user.memberships.map(membership =>
        membership.companyId === updatedCompany.id || membership.company?.id === updatedCompany.id
          ? { ...membership, company: { ...(membership.company || {}), ...updatedCompany } }
          : membership) : user.memberships,
    };
    saveSession(token, nextUser);
    dispatch(setSession({ token, user: nextUser }));
    dispatch(baseApi.util.invalidateTags([{ type: 'Me', id: 'CURRENT' },{ type: 'WorkEntries', id: 'SUMMARY' },{ type: 'WorkEntries', id: 'PAYROLL' }]));
  }

  async function submitCompany(event) {
    event.preventDefault(); setMessage(''); setActionError('');
    if (!normalizedName) { setActionError(t('company.nameRequired')); return; }
    try {
      const result = await updateCompanySettings({ name: normalizedName }).unwrap();
      const updatedCompany = result?.company || null;
      if (updatedCompany) syncCompanyIntoSession(updatedCompany);
      setName(updatedCompany?.name || normalizedName); setMessage(t('company.savedMessage'));
    } catch (mutationError) { setActionError(getApiErrorMessage(mutationError)); }
  }

  async function submitWorkRules(event){
    event.preventDefault();setWorkRulesMessage('');setWorkRulesActionError('');
    try{const result=await updateWorkRules({breakMinutes:Number(breakMinutes),standardDailyHours}).unwrap();setBreakMinutes(String(result.workRules.breakMinutes));setStandardDailyHours(String(result.workRules.standardDailyHours));setWorkRulesMessage(wc.saved)}catch(err){setWorkRulesActionError(getApiErrorMessage(err))}
  }

  async function submitBilling(event){
    event.preventDefault();setBillingMessage('');setBillingActionError('');
    try{const result=await updateCompanyBilling(billing).unwrap();setBilling({...emptyBilling,...result.company?.billingProfile});setBillingMessage(bc.saved)}catch(err){setBillingActionError(getApiErrorMessage(err))}
  }
  const setBillingField=(key,value)=>{setBillingMessage('');setBillingActionError('');setBilling(current=>({...current,[key]:value}))};
  const exampleGross=8.5;const exampleNet=Math.max(0,exampleGross-Number(breakMinutes||0)/60);const exampleOvertime=Math.max(0,exampleNet-Number(standardDailyHours||8));

  return (
    <section className="companySettingsPage pageStack">
      <header className="companySettingsHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('company.eyebrow')}</p><h1>{t('company.title')}</h1><p>{error ? t('company.loadError') : company?.name || t('company.current')}</p></div></header>

      <form className="companySettingsPanel screenCard" onSubmit={submitCompany}>
        <div className="compactHeader"><h2>{t('company.identity')}</h2><p>{t('company.copy')}</p></div>
        {isLoading ? <RequestLoadingState label={t('company.loading')} /> : null}
        {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
        {!isLoading && !error && company ? <>
          <label className="companySettingsField"><span>{t('company.name')}</span><input type="text" autoComplete="organization" maxLength={120} value={name} onChange={event => { setName(event.target.value); setMessage(''); setActionError(''); }} required /></label>
          <div className="companySettingsMetaCard"><div className="companySettingsMeta"><span>{t('company.slug')}</span><strong>{company.slug || '-'}</strong></div><p>{t('company.slugCopy')}</p></div>
          {message ? <p className="statusNote is-success">{message}</p> : null}{actionError ? <p className="statusNote is-error">{actionError}</p> : null}
          <button className="companySettingsButton" type="submit" disabled={updateState.isLoading || !hasChanges}>{updateState.isLoading ? t('company.saving') : hasChanges ? t('company.saveChanges') : t('company.saved')}</button>
        </> : null}
      </form>

      <form className="companySettingsPanel screenCard" onSubmit={submitWorkRules}>
        <div className="compactHeader"><h2>{wc.title}</h2><p>{wc.copy}</p></div>
        {workRulesLoading?<RequestLoadingState label={t('company.loading')} />:null}
        {workRulesError?<p className="statusNote is-error">{getApiErrorMessage(workRulesError)}</p>:null}
        {!workRulesLoading&&!workRulesError?<>
          <div className="companyBillingGrid">
            <label className="companySettingsField"><span>{wc.break}</span><select value={breakMinutes} onChange={e=>{setBreakMinutes(e.target.value);setWorkRulesMessage('')}}><option value="0">{wc.none}</option><option value="30">{wc.min30}</option><option value="60">{wc.min60}</option></select></label>
            <label className="companySettingsField"><span>{wc.norm}</span><input type="number" min="0.25" max="24" step="0.25" inputMode="decimal" value={standardDailyHours} onChange={e=>{setStandardDailyHours(e.target.value);setWorkRulesMessage('')}} /></label>
          </div>
          <p className="companySettingsHelp">{wc.normHint}</p>
          <div className="companySettingsMetaCard"><div className="companySettingsMeta"><span>{wc.example}: 07:00–15:30</span><strong>{exampleNet.toFixed(2)} h net</strong></div><p>8.50 h − {(Number(breakMinutes||0)/60).toFixed(2)} h = {exampleNet.toFixed(2)} h · +{exampleOvertime.toFixed(2)} h overtime</p></div>
        </>:null}
        {workRulesMessage?<p className="statusNote is-success">{workRulesMessage}</p>:null}{workRulesActionError?<p className="statusNote is-error">{workRulesActionError}</p>:null}
        <button className="companySettingsButton" type="submit" disabled={workRulesLoading||Boolean(workRulesError)||workRulesUpdateState.isLoading}>{workRulesUpdateState.isLoading?wc.saving:wc.save}</button>
      </form>

      <form className="companySettingsPanel screenCard" onSubmit={submitBilling}>
        <div className="compactHeader"><h2>{bc.title}</h2><p>{bc.copy}</p></div>
        {billingLoading?<RequestLoadingState label={t('company.loading')} />:null}
        {billingError?<p className="statusNote is-error">{getApiErrorMessage(billingError)}</p>:null}
        {!billingLoading&&!billingError?<div className="companyBillingGrid">
          <label className="companySettingsField"><span>{bc.ico}</span><input inputMode="numeric" value={billing.ico} onChange={e=>setBillingField('ico',e.target.value)} /></label>
          <label className="companySettingsField"><span>{bc.dic}</span><input value={billing.dic} onChange={e=>setBillingField('dic',e.target.value)} /></label>
          <label className="companySettingsField companyBillingWide"><span>{bc.address}</span><input autoComplete="street-address" value={billing.address} onChange={e=>setBillingField('address',e.target.value)} /></label>
          <label className="companySettingsField companyBillingWide"><span>{bc.email}</span><input type="email" autoComplete="email" value={billing.email} onChange={e=>setBillingField('email',e.target.value)} /></label>
        </div>:null}
        {billingMessage?<p className="statusNote is-success">{billingMessage}</p>:null}{billingActionError?<p className="statusNote is-error">{billingActionError}</p>:null}
        <button className="companySettingsButton" type="submit" disabled={billingLoading||Boolean(billingError)||billingUpdateState.isLoading}>{billingUpdateState.isLoading?bc.saving:bc.save}</button>
      </form>
    </section>
  );
}
