import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getWorktrackMessage } from '@shared/app/i18n/worktrackMessages.js';
import { useGetCompanySettingsQuery, useUpdateCompanySettingsMutation } from '../../features/worktrack/worktrackApi.js';
import { useGetCompanyBillingQuery, useUpdateCompanyBillingMutation } from '../../features/worktrack/billingApi.js';
import './CompanySettingsPage.css';

const BILLING_COPY={
 uk:{title:'Реквізити компанії',copy:'Ці дані будуть автоматично вказані як покупець у фактурах працівників.',ico:'IČO',dic:'DIČ / VAT ID',address:'Юридична адреса',email:'Email для фактур',save:'Зберегти реквізити',saved:'Реквізити збережено'},
 cs:{title:'Fakturační údaje firmy',copy:'Tyto údaje se automaticky použijí jako odběratel na fakturách pracovníků.',ico:'IČO',dic:'DIČ / VAT ID',address:'Sídlo firmy',email:'E-mail pro faktury',save:'Uložit fakturační údaje',saved:'Fakturační údaje uloženy'},
 en:{title:'Company billing details',copy:'These details are automatically used as the buyer on employee invoices.',ico:'Company ID (IČO)',dic:'VAT ID (DIČ)',address:'Registered address',email:'Invoice email',save:'Save billing details',saved:'Billing details saved'}
};

export function CompanySettingsPage(){
 const {language}=useI18n(); const t=key=>getWorktrackMessage(language,key); const c=BILLING_COPY[language]||BILLING_COPY.uk;
 const {data,error,isLoading}=useGetCompanySettingsQuery(); const [updateCompanySettings,companyState]=useUpdateCompanySettingsMutation();
 const {data:billingData,error:billingError}=useGetCompanyBillingQuery(); const [updateCompanyBilling,billingState]=useUpdateCompanyBillingMutation();
 const company=data?.company||null; const [name,setName]=useState(''); const [billing,setBilling]=useState({ico:'',dic:'',address:'',email:''}); const [message,setMessage]=useState(''); const [billingMessage,setBillingMessage]=useState(''); const [actionError,setActionError]=useState('');
 useEffect(()=>{if(company?.name)setName(company.name)},[company?.name]);
 useEffect(()=>{const value=billingData?.company?.billingProfile;if(value)setBilling({ico:value.ico||'',dic:value.dic||'',address:value.address||'',email:value.email||''})},[billingData]);
 async function submitCompany(e){e.preventDefault();setMessage('');setActionError('');try{await updateCompanySettings({name:name.trim()}).unwrap();setMessage(t('company.savedMessage'))}catch(err){setActionError(getApiErrorMessage(err))}}
 async function submitBilling(e){e.preventDefault();setBillingMessage('');setActionError('');try{await updateCompanyBilling(billing).unwrap();setBillingMessage(c.saved)}catch(err){setActionError(getApiErrorMessage(err))}}
 const setField=(key,value)=>setBilling(v=>({...v,[key]:value}));
 return <section className="companySettingsPage pageStack">
  <header className="companySettingsHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('company.eyebrow')}</p><h1>{t('company.title')}</h1><p>{error?t('company.loadError'):company?.name||t('company.current')}</p></div></header>
  <form className="companySettingsPanel screenCard" onSubmit={submitCompany}><div className="compactHeader"><h2>{t('company.identity')}</h2><p>{t('company.copy')}</p></div>{!isLoading&&company?<><label className="companySettingsField"><span>{t('company.name')}</span><input type="text" autoComplete="organization" maxLength={120} value={name} onChange={e=>setName(e.target.value)} required/></label><div className="companySettingsMetaCard"><div className="companySettingsMeta"><span>{t('company.slug')}</span><strong>{company.slug||'-'}</strong></div><p>{t('company.slugCopy')}</p></div>{message?<p className="statusNote is-success">{message}</p>:null}<button className="companySettingsButton" type="submit" disabled={companyState.isLoading}>{companyState.isLoading?t('company.saving'):t('company.saveChanges')}</button></>:null}</form>
  <form className="companySettingsPanel screenCard" onSubmit={submitBilling}><div className="compactHeader"><h2>{c.title}</h2><p>{c.copy}</p></div>{billingError?<p className="statusNote is-error">{getApiErrorMessage(billingError)}</p>:null}<label className="companySettingsField"><span>{c.ico}</span><input value={billing.ico} onChange={e=>setField('ico',e.target.value)} required/></label><label className="companySettingsField"><span>{c.dic}</span><input value={billing.dic} onChange={e=>setField('dic',e.target.value)}/></label><label className="companySettingsField"><span>{c.address}</span><input value={billing.address} onChange={e=>setField('address',e.target.value)} required/></label><label className="companySettingsField"><span>{c.email}</span><input type="email" value={billing.email} onChange={e=>setField('email',e.target.value)}/></label>{billingMessage?<p className="statusNote is-success">{billingMessage}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="companySettingsButton" type="submit" disabled={billingState.isLoading}>{billingState.isLoading?t('company.saving'):c.save}</button></form>
 </section>;
}
