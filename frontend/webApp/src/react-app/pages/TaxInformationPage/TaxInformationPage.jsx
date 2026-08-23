import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { getPageLocale, getPageMessage } from '@shared/app/i18n/worktrackPageMessages.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetTaxInformationQuery, useUpdateTaxInformationMutation } from '../../features/worktrack/billingApi.js';
import './TaxInformationPage.css';

const empty={businessName:'',ico:'',dic:'',address:'',iban:'',currency:'CZK',dueDays:'14',prefix:'WT'};
function currentMonthLabel(locale){return new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date())}

export function TaxInformationPage(){
 const navigate=useNavigate(); const {language}=useI18n(); const t=(key,values)=>getPageMessage(language,`tax.${key}`,values); const locale=getPageLocale(language);
 const {data,error,isLoading}=useGetTaxInformationQuery();
 const [updateTaxInformation,updateState]=useUpdateTaxInformationMutation();
 const [form,setForm]=useState(empty); const [saved,setSaved]=useState(false); const [actionError,setActionError]=useState('');
 useEffect(()=>{if(data?.taxInformation)setForm({...empty,...data.taxInformation})},[data]);
 const set=(key,value)=>{setSaved(false);setActionError('');setForm(v=>({...v,[key]:value}))};
 const submit=async e=>{e.preventDefault();setSaved(false);setActionError('');try{const result=await updateTaxInformation(form).unwrap();setForm({...empty,...result.taxInformation});setSaved(true)}catch(err){setActionError(getApiErrorMessage(err))}};
 return <section className="taxPage pageStack">
  <header className="taxHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('subtitle')}</p></div></header>
  <section className="taxCard screenCard"><div className="compactHeader"><h2>{t('hoursTable')}</h2><p>{t('hoursTableCopy')}</p></div><button className="taxPrimary" type="button" onClick={()=>navigate('/hours-table')}>{t('openHoursTable')}</button></section>
  <section className="taxCard screenCard"><div className="compactHeader"><h2>{t('invoicing')}</h2><p>{t('invoiceCopy')}</p></div><div className="invoicePreview"><div><span>{t('month')}</span><strong>{currentMonthLabel(locale)}</strong></div><div><span>{t('approved')}</span><strong>—</strong></div><div><span>{t('amount')}</span><strong>— {form.currency}</strong></div><span className="invoiceBadge">{t('draft')}</span></div><button className="taxPrimary" type="button" onClick={()=>navigate('/invoices')}>{t('openInvoices')}</button><p className="taxNote">{t('note')}</p></section>
  <form className="taxCard screenCard" onSubmit={submit}>
   <div className="compactHeader"><h2>{t('seller')}</h2><p>{t('sellerCopy')}</p></div>
   {isLoading?<p className="statusNote">{t('loading')}</p>:null}{error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
   {!isLoading&&!error?<div className="taxGrid">
    <label><span>{t('businessName')}</span><input value={form.businessName} onChange={e=>set('businessName',e.target.value)} /></label>
    <label><span>{t('ico')}</span><input inputMode="numeric" value={form.ico} onChange={e=>set('ico',e.target.value)} /></label>
    <label><span>{t('dic')}</span><input value={form.dic} onChange={e=>set('dic',e.target.value)} /></label>
    <label className="taxWide"><span>{t('address')}</span><input autoComplete="street-address" value={form.address} onChange={e=>set('address',e.target.value)} /></label>
    <label className="taxWide"><span>{t('iban')}</span><input value={form.iban} onChange={e=>set('iban',e.target.value)} /></label>
    <label><span>{t('currency')}</span><select value={form.currency} onChange={e=>set('currency',e.target.value)}><option>CZK</option><option>EUR</option></select></label>
    <label><span>{t('due')}</span><div className="taxInline"><input type="number" min="1" max="90" value={form.dueDays} onChange={e=>set('dueDays',e.target.value)} /><small>{t('days')}</small></div></label>
    <label><span>{t('prefix')}</span><input value={form.prefix} onChange={e=>set('prefix',e.target.value.toUpperCase())} /></label>
   </div>:null}
   {saved?<p className="statusNote is-success">{t('saved')}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="taxPrimary" type="submit" disabled={isLoading||Boolean(error)||updateState.isLoading}>{updateState.isLoading?t('saving'):t('save')}</button>
  </form>
 </section>;
}
