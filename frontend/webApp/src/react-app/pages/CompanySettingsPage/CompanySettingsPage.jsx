import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { baseApi } from '@shared/app/api/baseApi.js';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getWorktrackMessage } from '@shared/app/i18n/worktrackMessages.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import { useGetCompanyBillingQuery, useUpdateCompanyBillingMutation } from '../../features/worktrack/billingApi.js';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../../features/worktrack/worktrackApi.js';
import './CompanySettingsPage.css';

const BILLING_COPY={
 uk:{title:'Реквізити для фактур',copy:'Ці дані автоматично потрапляють у фактури працівників як реквізити роботодавця.',ico:'IČO',dic:'DIČ / VAT ID',address:'Юридична адреса',email:'Email для фактур',save:'Зберегти реквізити',saving:'Збереження…',saved:'Реквізити збережено'},
 cs:{title:'Fakturační údaje',copy:'Tyto údaje se automaticky použijí na fakturách pracovníků jako údaje odběratele.',ico:'IČO',dic:'DIČ / VAT ID',address:'Fakturační adresa',email:'E-mail pro faktury',save:'Uložit fakturační údaje',saving:'Ukládání…',saved:'Fakturační údaje byly uloženy'},
 en:{title:'Company billing details',copy:'These details are automatically used as the employer/buyer details on employee invoices.',ico:'Company ID (IČO)',dic:'VAT ID (DIČ)',address:'Billing address',email:'Invoice email',save:'Save billing details',saving:'Saving…',saved:'Billing details saved'}
};
const emptyBilling={ico:'',dic:'',address:'',email:''};

export function CompanySettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { language } = useI18n();
  const t = key => getWorktrackMessage(language, key);
  const bc=BILLING_COPY[language]||BILLING_COPY.uk;
  const { data, error, isLoading } = useGetCompanySettingsQuery();
  const [updateCompanySettings, updateState] = useUpdateCompanySettingsMutation();
  const {data:billingData,error:billingError,isLoading:billingLoading}=useGetCompanyBillingQuery();
  const [updateCompanyBilling,billingUpdateState]=useUpdateCompanyBillingMutation();
  const [billing,setBilling]=useState(emptyBilling);
  const [billingMessage,setBillingMessage]=useState('');
  const [billingActionError,setBillingActionError]=useState('');
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

  async function submitBilling(event){
    event.preventDefault();setBillingMessage('');setBillingActionError('');
    try{const result=await updateCompanyBilling(billing).unwrap();setBilling({...emptyBilling,...result.company?.billingProfile});setBillingMessage(bc.saved)}catch(err){setBillingActionError(getApiErrorMessage(err))}
  }
  const setBillingField=(key,value)=>{setBillingMessage('');setBillingActionError('');setBilling(current=>({...current,[key]:value}))};

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
