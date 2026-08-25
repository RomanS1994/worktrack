import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetTaxInformationQuery, useUpdateTaxInformationMutation } from '../../features/worktrack/billingApi.js';
import './TaxInformationPage.css';

const empty={businessName:'',ico:'',dic:'',address:'',iban:'',currency:'CZK',dueDays:'14',prefix:'WT'};

export function TaxInformationPage(){
 const {t}=useI18n();
 const {data,error,isLoading}=useGetTaxInformationQuery();
 const [updateTaxInformation,updateState]=useUpdateTaxInformationMutation();
 const [form,setForm]=useState(empty); const [saved,setSaved]=useState(false); const [actionError,setActionError]=useState('');
 useEffect(()=>{if(data?.taxInformation)setForm({...empty,...data.taxInformation,currency:'CZK'})},[data]);
 const set=(key,value)=>{setSaved(false);setActionError('');setForm(v=>({...v,[key]:value}))};
 const submit=async e=>{e.preventDefault();setSaved(false);setActionError('');try{const result=await updateTaxInformation({...form,currency:'CZK'}).unwrap();setForm({...empty,...result.taxInformation,currency:'CZK'});setSaved(true)}catch(err){setActionError(getApiErrorMessage(err))}};
 return <section className="taxPage pageStack">
  <header className="taxHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{t('tax.eyebrow')}</p><h1>{t('tax.title')}</h1><p>{t('tax.subtitle')}</p></div></header>
  <form className="taxCard screenCard" onSubmit={submit}>
   <div className="compactHeader"><h2>{t('tax.seller')}</h2><p>{t('tax.sellerCopy')}</p></div>
   {isLoading?<p className="statusNote">{t('tax.loading')}</p>:null}{error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
   {!isLoading&&!error?<div className="taxGrid">
    <label><span>{t('tax.businessName')}</span><input value={form.businessName} onChange={e=>set('businessName',e.target.value)} /></label>
    <label><span>{t('tax.ico')}</span><input inputMode="numeric" value={form.ico} onChange={e=>set('ico',e.target.value)} /></label>
    <label><span>{t('tax.dic')}</span><input value={form.dic} onChange={e=>set('dic',e.target.value)} /></label>
    <label className="taxWide"><span>{t('tax.address')}</span><input autoComplete="street-address" value={form.address} onChange={e=>set('address',e.target.value)} /></label>
    <label className="taxWide"><span>{t('tax.iban')}</span><input value={form.iban} onChange={e=>set('iban',e.target.value)} /></label>
    <label><span>{t('tax.currency')}</span><input value="CZK" readOnly aria-readonly="true" /></label>
    <label><span>{t('tax.due')}</span><div className="taxInline"><input type="number" min="1" max="90" value={form.dueDays} onChange={e=>set('dueDays',e.target.value)} /><small>{t('tax.days')}</small></div></label>
    <label><span>{t('tax.prefix')}</span><input value={form.prefix} onChange={e=>set('prefix',e.target.value.toUpperCase())} /></label>
   </div>:null}
   {saved?<p className="statusNote is-success">{t('tax.saved')}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="taxPrimary" type="submit" disabled={isLoading||Boolean(error)||updateState.isLoading}>{updateState.isLoading?t('tax.saving'):t('tax.save')}</button>
  </form>
 </section>;
}
