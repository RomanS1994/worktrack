import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { useGetPlatformAdminCompaniesQuery, useGetPlatformAdminOverviewQuery } from '../../features/worktrack/platformSubscriptionApi.js';
import { PlatformSubscriptionPaymentsPage } from '../PlatformSubscriptionPaymentsPage/PlatformSubscriptionPaymentsPage.jsx';
import './PlatformAdminPage.css';

const COPY = {
  uk: { title:'Адміністрування WorkTrack', intro:'Керування компаніями, доступом і ручними платежами підписок.', overview:'Огляд', companies:'Компанії', payments:'Платежі', companiesCount:'Компанії', activeSubscriptions:'Активні підписки', trials:'Пробний період', overdue:'Потребують уваги', employees:'Працівники', reviews:'Очікують перевірки', companyList:'Компанії та підписки', manager:'Менеджер', plan:'План', status:'Статус', trialUntil:'Пробний період до', periodUntil:'Підписка до', empty:'Компаній поки немає.', access:'Цей розділ доступний лише адміністратору WorkTrack.', loadError:'Не вдалося завантажити дані.', loading:'Завантаження даних…', unknown:'Невідомо', trial:'Пробний період', active:'Активна', grace:'Пільговий період', overdueStatus:'Прострочено', inactive:'Неактивна', platform:'ПЛАТФОРМА', workspace:'Адміністративний простір', attentionCopy:'Платежі, які очікують на ручну перевірку', viewPayments:'Переглянути платежі', back:'До WorkTrack', consoleActive:'Кабінет активний' },
  cs: { title:'Správa WorkTrack', intro:'Správa společností, přístupu a ručních plateb předplatného.', overview:'Přehled', companies:'Společnosti', payments:'Platby', companiesCount:'Společnosti', activeSubscriptions:'Aktivní předplatná', trials:'Zkušební období', overdue:'Vyžadují pozornost', employees:'Zaměstnanci', reviews:'Čeká na kontrolu', companyList:'Společnosti a předplatná', manager:'Manažer', plan:'Tarif', status:'Stav', trialUntil:'Zkušební období do', periodUntil:'Předplatné do', empty:'Zatím zde nejsou žádné společnosti.', access:'Tato část je dostupná pouze administrátorovi WorkTrack.', loadError:'Data se nepodařilo načíst.', loading:'Načítání dat…', unknown:'Neznámý', trial:'Zkušební období', active:'Aktivní', grace:'Dodatečná lhůta', overdueStatus:'Po splatnosti', inactive:'Neaktivní', platform:'PLATFORMA', workspace:'Administrátorský prostor', attentionCopy:'Platby čekající na ruční kontrolu', viewPayments:'Zobrazit platby', back:'Zpět do WorkTrack', consoleActive:'Panel je aktivní' },
  en: { title:'WorkTrack admin', intro:'Manage companies, access and manual subscription payments.', overview:'Overview', companies:'Companies', payments:'Payments', companiesCount:'Companies', activeSubscriptions:'Active subscriptions', trials:'On trial', overdue:'Need attention', employees:'Employees', reviews:'Awaiting review', companyList:'Companies and subscriptions', manager:'Manager', plan:'Plan', status:'Status', trialUntil:'Trial ends', periodUntil:'Subscription ends', empty:'No companies yet.', access:'This area is available to WorkTrack administrators only.', loadError:'Could not load admin data.', loading:'Loading admin data…', unknown:'Unknown', trial:'Trial', active:'Active', grace:'Grace period', overdueStatus:'Overdue', inactive:'Inactive', platform:'PLATFORM', workspace:'Administration workspace', attentionCopy:'Payments waiting for manual review', viewPayments:'View payments', back:'Back to WorkTrack', consoleActive:'Admin console active' },
};

function formatDate(value, language) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA', { day:'numeric', month:'short', year:'numeric' }).format(parsed);
}

function metricValue(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

function statusText(status, copy) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('TRIAL')) return copy.trial;
  if (normalized.includes('GRACE')) return copy.grace;
  if (normalized.includes('OVERDUE') || normalized.includes('PAST_DUE')) return copy.overdueStatus;
  if (normalized === 'ACTIVE' || normalized === 'PAID') return copy.active;
  return copy.inactive;
}

export function PlatformAdminPage() {
  const user = useSelector(selectUser);
  const { language } = useI18n();
  const copy = COPY[language] || COPY.uk;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const section = ['overview', 'companies', 'payments'].includes(searchParams.get('section')) ? searchParams.get('section') : 'overview';
  const isAdmin = Boolean(user?.isPlatformSubscriptionAdmin);
  const overviewQuery = useGetPlatformAdminOverviewQuery(undefined, { skip: !isAdmin });
  const companiesQuery = useGetPlatformAdminCompaniesQuery({ search: deferredSearch }, { skip: !isAdmin || section === 'payments' });
  const overview = overviewQuery.data || {};
  const companies = useMemo(() => Array.isArray(companiesQuery.data?.companies) ? companiesQuery.data.companies : [], [companiesQuery.data]);

  const selectSection = (next) => setSearchParams(next === 'overview' ? {} : { section: next });
  const statusError = overviewQuery.error || (section !== 'payments' && companiesQuery.error);

  return <section className="platformAdmin">
    <header className="platformAdminTopbar">
      <Link className="platformAdminBrand" to="/more" aria-label={copy.back}>
        <span className="platformAdminMark" aria-hidden="true">W</span>
        <span className="platformAdminBrandName">WORKTRACK<span>ADMIN</span></span>
      </Link>
      <div className="platformAdminTopbarMeta"><span className="platformAdminLiveDot" aria-hidden="true"/><span>{copy.platform}</span><i/> <strong>{copy.workspace}</strong></div>
      <Link className="platformAdminExit" to="/more"><span aria-hidden="true">↗</span><span>{copy.back}</span></Link>
    </header>
    {!isAdmin ? <section className="platformAdminNotice" role="alert">{copy.access}</section> : <>
      <div className="platformAdminPageHead"><div><p className="platformAdminEyebrow">{copy.platform} <span>/</span> {copy[section]}</p><h1>{copy[section]}</h1><p>{copy.intro}</p></div><div className="platformAdminHealth"><span className="platformAdminLiveDot"/><span>{copy.consoleActive}</span></div></div>
      <AdminTabs section={section} copy={copy} onSelect={selectSection} variant="top" />
      {section === 'payments' ? <PlatformSubscriptionPaymentsPage embedded /> : <>
        {(overviewQuery.isLoading || overviewQuery.isFetching || companiesQuery.isLoading && section === 'companies') ? <RequestLoadingState label={copy.loading} /> : null}
        {statusError ? <section className="platformAdminNotice is-error" role="alert">{getApiErrorMessage(statusError) || copy.loadError}</section> : null}
        {!overviewQuery.isLoading && !overviewQuery.error ? <>
          {section === 'overview' ? <>
            <section className="platformAdminMetrics" aria-label={copy.overview}>
              <Metric label={copy.companiesCount} value={overview.companiesCount} accent="blue" />
              <Metric label={copy.activeSubscriptions} value={overview.activeSubscriptionsCount} accent="green" />
              <Metric label={copy.trials} value={overview.trialCompaniesCount} accent="violet" />
              <Metric label={copy.overdue} value={overview.overdueCompaniesCount} accent="orange" />
              <Metric label={copy.employees} value={overview.activeEmployeesCount} accent="blue" />
              <Metric label={copy.reviews} value={overview.pendingPaymentReviewsCount} accent="rose" />
            </section>
            <section className="platformAdminSpotlight">
              <div><span className="platformAdminSpotlightIcon" aria-hidden="true">↗</span><div><h2>{copy.reviews}</h2><p>{copy.attentionCopy}</p></div></div>
              <button type="button" onClick={() => selectSection('payments')}>{copy.viewPayments}<span aria-hidden="true">→</span></button>
            </section>
            <CompaniesTable companies={companies} copy={copy} language={language} onShowAll={() => selectSection('companies')} compact />
          </> : <CompaniesTable companies={companies} copy={copy} language={language} search={search} onSearch={setSearch} />}
        </> : null}
      </>}
    </>}
    {isAdmin ? <AdminTabs section={section} copy={copy} onSelect={selectSection} variant="bottom" /> : null}
  </section>;
}

function AdminTabs({ section, copy, onSelect, variant }) {
  const items = [
    { key:'overview', icon:<><path d="M3 13h8V3H3v10Z"/><path d="M15 7h6V3h-6v4Z"/><path d="M15 21h6v-10h-6v10Z"/><path d="M3 21h8v-4H3v4Z"/></> },
    { key:'companies', icon:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h3M8 12h3M8 16h3M15 8h2v8h-2"/></> },
    { key:'payments', icon:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></> },
  ];
  return <nav className={`platformAdminNav platformAdminNav--${variant}`} aria-label={copy.title}>
    {items.map(({ key, icon }) => <button type="button" key={key} className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => onSelect(key)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg><span>{copy[key]}</span>
    </button>)}
  </nav>;
}

function Metric({ label, value, accent }) {
  return <article className={`platformAdminMetric accent-${accent}`}><span className="platformAdminMetricDot" aria-hidden="true"/><span className="platformAdminMetricLabel">{label}</span><strong>{metricValue(value).toLocaleString()}</strong></article>;
}

function CompaniesTable({ companies, copy, language, compact = false, onShowAll, search, onSearch }) {
  const visible = compact ? companies.slice(0, 5) : companies;
  return <section className="platformAdminCompanies">
    <header><div><p className="sectionEyebrow">{copy.platform}</p><h2>{copy.companyList}</h2></div>{compact ? <button type="button" onClick={onShowAll}>{copy.companies} <span aria-hidden="true">→</span></button> : <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={language === 'en' ? 'Search companies or managers' : language === 'cs' ? 'Hledat společnosti nebo manažery' : 'Пошук компанії або менеджера'} aria-label={copy.companies} />}</header>
    {!visible.length ? <div className="platformAdminEmpty">{copy.empty}</div> : <div className="platformAdminCompanyList">{visible.map(company => {
      const status = company.subscriptionStatus || company.status;
      const isTrial = String(status || '').toUpperCase().includes('TRIAL');
      return <article key={company.id} className="platformAdminCompany">
        <div className="platformAdminCompanyName"><span className="platformAdminCompanyAvatar" aria-hidden="true">{String(company.name || '?').trim().slice(0, 1).toUpperCase()}</span><span><strong>{company.name || copy.unknown}</strong><small>{company.managerName || company.managerEmail || '—'}</small></span></div>
        <div className="platformAdminCompanyEmployees"><strong>{metricValue(company.activeEmployees)}</strong><small>{copy.employees.toLowerCase()}</small></div>
        <div className="platformAdminCompanyPlan"><strong>{company.planCode || '—'}</strong><small>{copy.plan}</small></div>
        <div className="platformAdminCompanyStatus"><span className={`platformAdminStatus is-${String(status || 'inactive').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{statusText(status, copy)}</span><small>{isTrial ? copy.trialUntil : copy.periodUntil}: {formatDate(isTrial ? company.trialEndsAt : company.currentPeriodEnd, language)}</small></div>
      </article>;
    })}</div>}
  </section>;
}
