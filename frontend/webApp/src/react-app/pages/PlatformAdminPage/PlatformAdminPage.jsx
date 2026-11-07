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
  uk: { title:'Адміністрування WorkTrack', intro:'Керування компаніями, доступом і ручними платежами підписок.', overview:'Огляд', companies:'Компанії', payments:'Платежі', companiesCount:'Компанії', activeSubscriptions:'Активні підписки', trials:'Пробний період', overdue:'Потребують уваги', employees:'Працівники', reviews:'Очікують перевірки', companyList:'Компанії та підписки', manager:'Менеджер', plan:'План', status:'Статус', trialUntil:'Пробний період до', periodUntil:'Підписка до', empty:'Компаній поки немає.', access:'Цей розділ доступний лише адміністратору WorkTrack.', loadError:'Не вдалося завантажити дані.', loading:'Завантаження даних…', unknown:'Невідомо', trial:'Пробний період', active:'Активна', grace:'Пільговий період', overdueStatus:'Прострочено', inactive:'Неактивна' },
  cs: { title:'Správa WorkTrack', intro:'Správa společností, přístupu a ručních plateb předplatného.', overview:'Přehled', companies:'Společnosti', payments:'Platby', companiesCount:'Společnosti', activeSubscriptions:'Aktivní předplatná', trials:'Zkušební období', overdue:'Vyžadují pozornost', employees:'Zaměstnanci', reviews:'Čeká na kontrolu', companyList:'Společnosti a předplatná', manager:'Manažer', plan:'Tarif', status:'Stav', trialUntil:'Zkušební období do', periodUntil:'Předplatné do', empty:'Zatím zde nejsou žádné společnosti.', access:'Tato část je dostupná pouze administrátorovi WorkTrack.', loadError:'Data se nepodařilo načíst.', loading:'Načítání dat…', unknown:'Neznámý', trial:'Zkušební období', active:'Aktivní', grace:'Dodatečná lhůta', overdueStatus:'Po splatnosti', inactive:'Neaktivní' },
  en: { title:'WorkTrack admin', intro:'Manage companies, access and manual subscription payments.', overview:'Overview', companies:'Companies', payments:'Payments', companiesCount:'Companies', activeSubscriptions:'Active subscriptions', trials:'On trial', overdue:'Need attention', employees:'Employees', reviews:'Awaiting review', companyList:'Companies and subscriptions', manager:'Manager', plan:'Plan', status:'Status', trialUntil:'Trial ends', periodUntil:'Subscription ends', empty:'No companies yet.', access:'This area is available to WorkTrack administrators only.', loadError:'Could not load admin data.', loading:'Loading admin data…', unknown:'Unknown', trial:'Trial', active:'Active', grace:'Grace period', overdueStatus:'Overdue', inactive:'Inactive' },
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

  return <main className="platformAdmin pageStack">
    <header className="platformAdminHeader">
      <div className="platformAdminBrand"><span className="platformAdminMark" aria-hidden="true">W</span><span>WORKTRACK <b>ADMIN</b></span></div>
      <div className="platformAdminHeading"><p className="sectionEyebrow">Platform operations</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
      <Link className="platformAdminExit" to="/more">{language === 'en' ? 'Back to app' : language === 'cs' ? 'Zpět do aplikace' : 'До застосунку'} <span aria-hidden="true">↗</span></Link>
    </header>
    {!isAdmin ? <section className="platformAdminNotice" role="alert">{copy.access}</section> : <>
      <nav className="platformAdminNav" aria-label={copy.title}>
        {['overview','companies','payments'].map(key => <button type="button" key={key} className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => selectSection(key)}>{copy[key]}</button>)}
      </nav>
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
              <div><span className="platformAdminSpotlightIcon" aria-hidden="true">↗</span><div><h2>{copy.reviews}</h2><p>{metricValue(overview.pendingPaymentReviewsCount)} {language === 'en' ? 'payments are ready for review.' : language === 'cs' ? 'plateb čeká na kontrolu.' : 'платежів чекають на перевірку.'}</p></div></div>
              <button type="button" onClick={() => selectSection('payments')}>{language === 'en' ? 'Review payments' : language === 'cs' ? 'Zkontrolovat platby' : 'Перевірити платежі'} <span aria-hidden="true">→</span></button>
            </section>
            <CompaniesTable companies={companies} copy={copy} language={language} onShowAll={() => selectSection('companies')} compact />
          </> : <CompaniesTable companies={companies} copy={copy} language={language} search={search} onSearch={setSearch} />}
        </> : null}
      </>}
    </>}
  </main>;
}

function Metric({ label, value, accent }) {
  return <article className={`platformAdminMetric accent-${accent}`}><span className="platformAdminMetricDot" aria-hidden="true"/><span className="platformAdminMetricLabel">{label}</span><strong>{metricValue(value).toLocaleString()}</strong></article>;
}

function CompaniesTable({ companies, copy, language, compact = false, onShowAll, search, onSearch }) {
  const visible = compact ? companies.slice(0, 5) : companies;
  return <section className="platformAdminCompanies">
    <header><div><p className="sectionEyebrow">DIRECTORY</p><h2>{copy.companyList}</h2></div>{compact ? <button type="button" onClick={onShowAll}>{copy.companies} <span aria-hidden="true">→</span></button> : <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={language === 'en' ? 'Search companies or managers' : language === 'cs' ? 'Hledat společnosti nebo manažery' : 'Пошук компанії або менеджера'} aria-label={copy.companies} />}</header>
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
