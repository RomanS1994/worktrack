import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetTaxInformationQuery, useUpdateTaxInformationMutation } from '../../features/worktrack/billingApi.js';
import './TaxInformationPage.css';

const COPY = {
  uk: { eyebrow:'Налаштування', title:'Податкова інформація', subtitle:'Реквізити для автоматичного створення фактур роботодавцю.', seller:'Ваші реквізити', sellerCopy:'Ці дані будуть підставлятися у нові фактури.', businessName:'Ім’я / назва підприємця', ico:'IČO', dic:'DIČ / VAT ID', address:'Адреса', iban:'IBAN / банківський рахунок', currency:'Валюта', due:'Термін оплати', days:'днів', prefix:'Префікс фактури', save:'Зберегти податкові дані', saving:'Збереження…', saved:'Податкові дані збережено', loading:'Завантаження реквізитів…', hoursTable:'Таблиця годин', hoursTableCopy:'Перегляньте всі записи за місяць, статуси погодження та суми.', openHoursTable:'Відкрити таблицю', invoicing:'Фактури', invoiceCopy:'Фактура формується з погоджених годин. Після відправлення роботодавець отримає її у своєму кабінеті.', month:'Період', approved:'Погоджені години', amount:'Сума', create:'Створити фактуру', draft:'Чернетка', note:'Наступним кроком підключимо створення PDF, нумерацію та кабінет фактур роботодавця.' },
  cs: { eyebrow:'Nastavení', title:'Daňové údaje', subtitle:'Údaje pro automatické vystavování faktur zaměstnavateli.', seller:'Vaše fakturační údaje', sellerCopy:'Tyto údaje se automaticky použijí na nové faktuře.', businessName:'Jméno / název podnikatele', ico:'IČO', dic:'DIČ / VAT ID', address:'Adresa', iban:'IBAN / bankovní účet', currency:'Měna', due:'Splatnost', days:'dnů', prefix:'Prefix faktury', save:'Uložit daňové údaje', saving:'Ukládání…', saved:'Daňové údaje byly uloženy', loading:'Načítání údajů…', hoursTable:'Tabulka hodin', hoursTableCopy:'Měsíční záznamy, stav schválení a částky na jednom místě.', openHoursTable:'Otevřít tabulku', invoicing:'Faktury', invoiceCopy:'Faktura se vytvoří ze schválených hodin. Po odeslání ji zaměstnavatel uvidí ve svém účtu.', month:'Období', approved:'Schválené hodiny', amount:'Částka', create:'Vytvořit fakturu', draft:'Koncept', note:'V dalším kroku připojíme PDF, číslování a faktury v účtu zaměstnavatele.' },
  en: { eyebrow:'Settings', title:'Tax information', subtitle:'Details used to automatically invoice your employer.', seller:'Your billing details', sellerCopy:'These details will be prefilled on every new invoice.', businessName:'Name / business name', ico:'Company ID (IČO)', dic:'VAT ID (DIČ)', address:'Billing address', iban:'IBAN / bank account', currency:'Currency', due:'Payment terms', days:'days', prefix:'Invoice prefix', save:'Save tax information', saving:'Saving…', saved:'Tax information saved', loading:'Loading billing details…', hoursTable:'Hours table', hoursTableCopy:'Review monthly entries, approval statuses and amounts in one place.', openHoursTable:'Open hours table', invoicing:'Invoices', invoiceCopy:'Invoices are created from approved hours. After sending, your employer receives the invoice in their account.', month:'Period', approved:'Approved hours', amount:'Amount', create:'Create invoice', draft:'Draft', note:'Next we will connect PDF generation, invoice numbering and the employer invoice inbox.' }
};

const empty={businessName:'',ico:'',dic:'',address:'',iban:'',currency:'CZK',dueDays:'14',prefix:'WT'};
function localeFor(language){return language==='cs'?'cs-CZ':language==='en'?'en-GB':'uk-UA'}
function currentMonthLabel(language){return new Intl.DateTimeFormat(localeFor(language),{month:'long',year:'numeric'}).format(new Date())}

export function TaxInformationPage(){
 const navigate=useNavigate(); const {language}=useI18n(); const c=COPY[language]||COPY.uk;
 const {data,error,isLoading}=useGetTaxInformationQuery();
 const [updateTaxInformation,updateState]=useUpdateTaxInformationMutation();
 const [form,setForm]=useState(empty); const [saved,setSaved]=useState(false); const [actionError,setActionError]=useState('');
 useEffect(()=>{if(data?.taxInformation)setForm({...empty,...data.taxInformation})},[data]);
 const set=(key,value)=>{setSaved(false);setActionError('');setForm(v=>({...v,[key]:value}))};
 const submit=async e=>{e.preventDefault();setSaved(false);setActionError('');try{const result=await updateTaxInformation(form).unwrap();setForm({...empty,...result.taxInformation});setSaved(true)}catch(err){setActionError(getApiErrorMessage(err))}};
 return <section className="taxPage pageStack">
  <header className="taxHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
  <section className="taxCard screenCard"><div className="compactHeader"><h2>{c.hoursTable}</h2><p>{c.hoursTableCopy}</p></div><button className="taxPrimary" type="button" onClick={()=>navigate('/hours-table')}>{c.openHoursTable}</button></section>
  <form className="taxCard screenCard" onSubmit={submit}>
   <div className="compactHeader"><h2>{c.seller}</h2><p>{c.sellerCopy}</p></div>
   {isLoading?<p className="statusNote">{c.loading}</p>:null}{error?<p className="statusNote is-error">{getApiErrorMessage(error)}</p>:null}
   {!isLoading&&!error?<div className="taxGrid">
    <label><span>{c.businessName}</span><input value={form.businessName} onChange={e=>set('businessName',e.target.value)} /></label>
    <label><span>{c.ico}</span><input inputMode="numeric" value={form.ico} onChange={e=>set('ico',e.target.value)} /></label>
    <label><span>{c.dic}</span><input value={form.dic} onChange={e=>set('dic',e.target.value)} /></label>
    <label className="taxWide"><span>{c.address}</span><input autoComplete="street-address" value={form.address} onChange={e=>set('address',e.target.value)} /></label>
    <label className="taxWide"><span>{c.iban}</span><input value={form.iban} onChange={e=>set('iban',e.target.value)} /></label>
    <label><span>{c.currency}</span><select value={form.currency} onChange={e=>set('currency',e.target.value)}><option>CZK</option><option>EUR</option></select></label>
    <label><span>{c.due}</span><div className="taxInline"><input type="number" min="1" max="90" value={form.dueDays} onChange={e=>set('dueDays',e.target.value)} /><small>{c.days}</small></div></label>
    <label><span>{c.prefix}</span><input value={form.prefix} onChange={e=>set('prefix',e.target.value.toUpperCase())} /></label>
   </div>:null}
   {saved?<p className="statusNote is-success">{c.saved}</p>:null}{actionError?<p className="statusNote is-error">{actionError}</p>:null}<button className="taxPrimary" type="submit" disabled={isLoading||Boolean(error)||updateState.isLoading}>{updateState.isLoading?c.saving:c.save}</button>
  </form>
  <section className="taxCard screenCard"><div className="compactHeader"><h2>{c.invoicing}</h2><p>{c.invoiceCopy}</p></div>
   <div className="invoicePreview"><div><span>{c.month}</span><strong>{currentMonthLabel(language)}</strong></div><div><span>{c.approved}</span><strong>—</strong></div><div><span>{c.amount}</span><strong>— {form.currency}</strong></div><span className="invoiceBadge">{c.draft}</span></div>
   <button className="taxPrimary" type="button" disabled>{c.create}</button><p className="taxNote">{c.note}</p>
  </section>
 </section>;
}
