import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { useGetPlatformAdminCompaniesQuery, useGetPlatformAdminOverviewQuery, useDeletePlatformAdminTestCompanyMutation } from '../../features/worktrack/platformSubscriptionApi.js';
import { PlatformSubscriptionPaymentsPage } from '../PlatformSubscriptionPaymentsPage/PlatformSubscriptionPaymentsPage.jsx';
import './PlatformAdminPage.css';

const COPY = {
  uk: { title:'Адміністрування WorkTrack', intro:'Керування компаніями, доступом і ручними платежами підписок.', overview:'Огляд', companies:'Компанії', payments:'Платежі', companiesCount:'Компанії', activeSubscriptions:'Активні підписки', trials:'Пробний період', overdue:'Потребують уваги', employees:'Працівники', reviews:'Очікують перевірки', companyList:'Компанії та підписки', recentCompanies:'Нещодавні компанії', manager:'Менеджер', plan:'План', status:'Статус', trialUntil:'Пробний період до', periodUntil:'Підписка до', empty:'Компаній поки немає.', access:'Цей розділ доступний лише адміністратору WorkTrack.', loadError:'Не вдалося завантажити дані.', loading:'Завантаження даних…', unknown:'Невідомо', trial:'Пробний період', active:'Активна', grace:'Пільговий період', overdueStatus:'Прострочено', inactive:'Неактивна', platform:'ПЛАТФОРМА', workspace:'Адміністративний простір', attentionCopy:'Платежі, які очікують на ручну перевірку', viewPayments:'Переглянути платежі', back:'До WorkTrack', consoleActive:'Кабінет активний', allReviewed:'Усі платежі перевірені', employeesShort:'Працівники', viewAll:'Усі компанії', searchCompanies:'Пошук компаній або менеджерів', filters:{all:'Усі',active:'Активні',trial:'Пробний період',attention:'Потребують уваги',inactive:'Без підписки'}, tasks:'Потрібна увага', trialEnding:'Пробний період скоро завершиться', upcomingTrials:'Пробний період завершується протягом 7 днів', openCompanies:'Переглянути компанії', details:'Деталі', noResults:'За цими фільтрами компаній немає.', created:'Створена', activeEmployees:'Активні працівники', dueSoon:'Завершується', clearFilter:'Скинути фільтри', close:'Згорнути', deleteTestHint:'Codex-компанії для тестування можна видалити, якщо в них немає робочих даних.', deleteTestCompany:'Видалити тестову компанію', deleteTestTitle:'Видалити тестову компанію?', deleteTestBody:'Компанія «{name}» і членство її тестового менеджера будуть видалені без можливості відновлення. Сервер перед цим перевірить, що в компанії немає працівників, підписки, платежів чи робочих даних.', cancel:'Скасувати', delete:'Видалити', deleting:'Видаляємо…', deleteError:'Не вдалося видалити тестову компанію.', trendsTitle:'Динаміка за місяць', companiesCreated:'Нові компанії', employeesAdded:'Додані працівники' },
  cs: { title:'Správa WorkTrack', intro:'Správa společností, přístupu a ručních plateb předplatného.', overview:'Přehled', companies:'Společnosti', payments:'Platby', companiesCount:'Společnosti', activeSubscriptions:'Aktivní předplatná', trials:'Zkušební období', overdue:'Vyžadují pozornost', employees:'Zaměstnanci', reviews:'Čeká na kontrolu', companyList:'Společnosti a předplatná', recentCompanies:'Nedávné společnosti', manager:'Manažer', plan:'Tarif', status:'Stav', trialUntil:'Zkušební období do', periodUntil:'Předplatné do', empty:'Zatím zde nejsou žádné společnosti.', access:'Tato část je dostupná pouze administrátorovi WorkTrack.', loadError:'Data se nepodařilo načíst.', loading:'Načítání dat…', unknown:'Neznámý', trial:'Zkušební období', active:'Aktivní', grace:'Dodatečná lhůta', overdueStatus:'Po splatnosti', inactive:'Neaktivní', platform:'PLATFORMA', workspace:'Administrátorský prostor', attentionCopy:'Platby čekající na ruční kontrolu', viewPayments:'Zobrazit platby', back:'Zpět do WorkTrack', consoleActive:'Panel je aktivní', allReviewed:'Všechny platby jsou zkontrolovány', employeesShort:'Zaměstnanci', viewAll:'Všechny společnosti', searchCompanies:'Hledat společnosti nebo manažery', filters:{all:'Vše',active:'Aktivní',trial:'Zkušební období',attention:'Vyžadují pozornost',inactive:'Bez předplatného'},tasks:'Vyžaduje pozornost',trialEnding:'Zkušební období brzy končí',upcomingTrials:'Zkušební období končí během 7 dnů',openCompanies:'Zobrazit společnosti',details:'Detaily',noResults:'Žádné společnosti neodpovídají filtrům.',created:'Vytvořena',activeEmployees:'Aktivní zaměstnanci',dueSoon:'Končí',clearFilter:'Zrušit filtry',close:'Skrýt', deleteTestHint:'Testovací společnosti Codex lze odstranit, pokud neobsahují pracovní data.', deleteTestCompany:'Odstranit testovací společnost', deleteTestTitle:'Odstranit testovací společnost?', deleteTestBody:'Společnost „{name}“ a členství jejího testovacího manažera budou trvale odstraněny. Server nejprve ověří, že společnost nemá zaměstnance, předplatné, platby ani pracovní data.', cancel:'Zrušit', delete:'Odstranit', deleting:'Odstraňování…', deleteError:'Testovací společnost se nepodařilo odstranit.' },
  en: { title:'WorkTrack admin', intro:'Manage companies, access and manual subscription payments.', overview:'Overview', companies:'Companies', payments:'Payments', companiesCount:'Companies', activeSubscriptions:'Active subscriptions', trials:'On trial', overdue:'Need attention', employees:'Employees', reviews:'Awaiting review', companyList:'Companies and subscriptions', recentCompanies:'Recent companies', manager:'Manager', plan:'Plan', status:'Status', trialUntil:'Trial ends', periodUntil:'Subscription ends', empty:'No companies yet.', access:'This area is available to WorkTrack administrators only.', loadError:'Could not load admin data.', loading:'Loading admin data…', unknown:'Unknown', trial:'Trial', active:'Active', grace:'Grace period', overdueStatus:'Overdue', inactive:'Inactive', platform:'PLATFORM', workspace:'Administration workspace', attentionCopy:'Payments waiting for manual review', viewPayments:'View payments', back:'Back to WorkTrack', consoleActive:'Admin console active', allReviewed:'All payments are reviewed', employeesShort:'Employees', viewAll:'All companies', searchCompanies:'Search companies or managers', filters:{all:'All',active:'Active',trial:'Trial',attention:'Need attention',inactive:'No subscription'},tasks:'Needs attention',trialEnding:'Trial ending soon',upcomingTrials:'Trials ending within 7 days',openCompanies:'View companies',details:'Details',noResults:'No companies match these filters.',created:'Created',activeEmployees:'Active employees',dueSoon:'Ends',clearFilter:'Clear filters',close:'Hide', deleteTestHint:'Codex test companies can be deleted if they contain no work data.', deleteTestCompany:'Delete test company', deleteTestTitle:'Delete this test company?', deleteTestBody:'Company “{name}” and its test manager membership will be permanently deleted. The server first checks that it has no employees, subscription, payments, or work data.', cancel:'Cancel', delete:'Delete', deleting:'Deleting…', deleteError:'Could not delete the test company.' },
};

function formatDate(value, language) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA', { day:'numeric', month:'short', year:'numeric' }).format(parsed);
}

function metricValue(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

function trendMonth(value, language) {
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA', { month:'short' }).format(new Date(year, month - 1, 1));
}

function statusText(status, copy) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('TRIAL')) return copy.trial;
  if (normalized.includes('GRACE')) return copy.grace;
  if (normalized.includes('OVERDUE') || normalized.includes('PAST_DUE') || normalized.includes('EXPIRED')) return copy.overdueStatus;
  if (normalized === 'ACTIVE' || normalized === 'PAID') return copy.active;
  return copy.inactive;
}

export function PlatformAdminPage() {
  const user = useSelector(selectUser);
  const { language } = useI18n();
  const copy = COPY[language] || COPY.uk;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [pendingDeleteCompany, setPendingDeleteCompany] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteTestCompany, deleteTestCompanyState] = useDeletePlatformAdminTestCompanyMutation();
  const deferredSearch = useDeferredValue(search);
  const section = ['overview', 'companies', 'payments'].includes(searchParams.get('section')) ? searchParams.get('section') : 'overview';
  const companyFilter = ['all','active','trial','attention','inactive'].includes(searchParams.get('filter')) ? searchParams.get('filter') : 'all';
  const isAdmin = Boolean(user?.isPlatformSubscriptionAdmin);
  const overviewQuery = useGetPlatformAdminOverviewQuery(undefined, { skip: !isAdmin });
  const companiesQuery = useGetPlatformAdminCompaniesQuery({ search: section === 'companies' ? deferredSearch : '' }, { skip: !isAdmin || section === 'payments' });
  const overview = overviewQuery.data || {};
  const companies = useMemo(() => Array.isArray(companiesQuery.data?.companies) ? companiesQuery.data.companies : [], [companiesQuery.data]);

  const selectSection = (next) => setSearchParams(next === 'overview' ? {} : { section: next });
  const showCompanies = (filter = 'all') => setSearchParams(filter === 'all' ? { section:'companies' } : { section:'companies', filter });
  const now = Date.now();
  const upcomingTrialsCount = companies.filter(company => {
    if (!String(company.subscriptionStatus || '').toUpperCase().includes('TRIAL') || !company.trialEndsAt) return false;
    const remaining = new Date(company.trialEndsAt).getTime() - now;
    return remaining >= 0 && remaining <= 7 * 86400000;
  }).length;
  const attentionItems = [
    ...(metricValue(overview.pendingPaymentReviewsCount) > 0 ? [{ id:'payments', label:copy.reviews, count:metricValue(overview.pendingPaymentReviewsCount), action:() => selectSection('payments') }] : []),
    ...(metricValue(overview.overdueCompaniesCount) > 0 ? [{ id:'overdue', label:copy.overdue, count:metricValue(overview.overdueCompaniesCount), action:() => showCompanies('attention') }] : []),
    ...(upcomingTrialsCount > 0 ? [{ id:'trials', label:copy.trialEnding, count:upcomingTrialsCount, action:() => showCompanies('trial'), hint:copy.upcomingTrials }] : []),
  ];
  const statusError = overviewQuery.error || (section !== 'payments' && companiesQuery.error);
  const trendLabels = language === 'cs'
    ? { title:'Vývoj za měsíc', companies:'Nové společnosti', employees:'Noví zaměstnanci' }
    : language === 'en'
      ? { title:'Monthly activity', companies:'New companies', employees:'Employees added' }
      : { title:copy.trendsTitle, companies:copy.companiesCreated, employees:copy.employeesAdded };

  async function confirmDeleteTestCompany() {
    if (!pendingDeleteCompany) return;
    setDeleteError('');
    try {
      await deleteTestCompany(pendingDeleteCompany.id).unwrap();
      setPendingDeleteCompany(null);
      await Promise.all([companiesQuery.refetch(), overviewQuery.refetch()]);
    } catch (error) {
      setDeleteError(getApiErrorMessage(error) || copy.deleteError);
    }
  }

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
      <div className="platformAdminPageHead"><div><p className="platformAdminEyebrow">{copy.platform} <span>/</span> {copy[section]}</p><h1>{copy[section]}</h1>{section !== 'overview' ? <p>{copy.intro}</p> : null}</div></div>
      <AdminTabs section={section} copy={copy} onSelect={selectSection} variant="top" />
      {section === 'payments' ? <PlatformSubscriptionPaymentsPage embedded /> : <>
        {(overviewQuery.isLoading || overviewQuery.isFetching || companiesQuery.isLoading && section === 'companies') ? <RequestLoadingState label={copy.loading} /> : null}
        {statusError ? <section className="platformAdminNotice is-error" role="alert">{getApiErrorMessage(statusError) || copy.loadError}</section> : null}
        {!overviewQuery.isLoading && !overviewQuery.error ? <>
          {section === 'overview' ? <>
            <section className="platformAdminOverview" aria-label={copy.overview}>
              <article className="platformAdminOverviewHero">
                <button className="platformAdminOverviewPrimary" type="button" onClick={() => showCompanies('all')}><span>{copy.companiesCount}</span><strong>{metricValue(overview.companiesCount).toLocaleString()}</strong></button>
                <div className="platformAdminOverviewSecondary">
                  <button type="button" onClick={() => showCompanies('active')}><svg className="platformAdminOverviewIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg><strong>{metricValue(overview.activeSubscriptionsCount).toLocaleString()}</strong><span>{copy.activeSubscriptions}</span></button>
                  <button type="button" onClick={() => showCompanies('all')}><svg className="platformAdminOverviewIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg><strong>{metricValue(overview.activeEmployeesCount).toLocaleString()}</strong><span>{copy.employeesShort}</span></button>
                </div>
              </article>
              <div className="platformAdminOverviewStats">
                <Metric label={copy.trials} value={overview.trialCompaniesCount} onClick={() => showCompanies('trial')} />
                <Metric label={copy.overdue} value={overview.overdueCompaniesCount} attention onClick={() => showCompanies('attention')} />
                <Metric label={copy.reviews} value={overview.pendingPaymentReviewsCount} attention onClick={() => selectSection('payments')} />
              </div>
            </section>
            {Array.isArray(overview.trends) && overview.trends.length ? <section className="platformAdminTrends" aria-label={trendLabels.title}>
              <header><h2>{trendLabels.title}</h2><div><span><i className="is-company"/>{trendLabels.companies}</span><span><i className="is-employee"/>{trendLabels.employees}</span></div></header>
              <div className="platformAdminTrendChart" role="img" aria-label={overview.trends.map(item => `${trendMonth(item.month,language)}: ${trendLabels.companies} ${metricValue(item.companiesCreated)}, ${trendLabels.employees} ${metricValue(item.employeesAdded)}`).join('; ')}>
                {overview.trends.map(item => {
                  const max = Math.max(1,...overview.trends.flatMap(point => [metricValue(point.companiesCreated),metricValue(point.employeesAdded)]));
                  return <div className="platformAdminTrendMonth" key={item.month}>
                    <div className="platformAdminTrendBars"><span className="is-company" style={{height:`${metricValue(item.companiesCreated)/max*100}%`}}/><span className="is-employee" style={{height:`${metricValue(item.employeesAdded)/max*100}%`}}/></div>
                    <small>{trendMonth(item.month,language)}</small>
                  </div>;
                })}
              </div>
            </section> : null}
            {attentionItems.length ? <section className="platformAdminTasks"><header><span>{copy.tasks}</span><span>{attentionItems.reduce((sum,item)=>sum+item.count,0)}</span></header>{attentionItems.map(item=><button type="button" key={item.id} onClick={item.action}><span className="platformAdminTaskDot"/><span className="platformAdminTaskText"><strong>{item.label}</strong>{item.hint?<small>{item.hint}</small>:null}</span><b>{item.count}</b><span className="platformAdminTaskArrow" aria-hidden="true">→</span></button>)}</section> : <div className="platformAdminReviewed"><span aria-hidden="true">✓</span>{copy.allReviewed}</div>}
            <CompaniesTable companies={companies} copy={copy} language={language} onDeleteCompany={company=>{setDeleteError('');setPendingDeleteCompany(company)}} onShowAll={() => selectSection('companies')} compact expandedCompany={expandedCompany} onExpand={setExpandedCompany} />
          </> : <CompaniesTable companies={companies} copy={copy} language={language} onDeleteCompany={company=>{setDeleteError('');setPendingDeleteCompany(company)}} search={search} onSearch={setSearch} filter={companyFilter} onFilter={showCompanies} expandedCompany={expandedCompany} onExpand={setExpandedCompany} />}
        </> : null}
      </>}
    </>}
    {isAdmin ? <AdminTabs section={section} copy={copy} onSelect={selectSection} variant="bottom" /> : null}
    {isAdmin && pendingDeleteCompany ? <div className="platformAdminDeleteOverlay"><section className="platformAdminDeleteDialog" role="alertdialog" aria-modal="true" aria-labelledby="platformAdminDeleteTitle"><span className="platformAdminDeleteEyebrow">{copy.platform}</span><h2 id="platformAdminDeleteTitle">{copy.deleteTestTitle}</h2><p>{copy.deleteTestBody.replace('{name}',pendingDeleteCompany.name)}</p>{deleteError?<p className="platformAdminDeleteError" role="alert">{deleteError}</p>:null}<div><button type="button" onClick={()=>setPendingDeleteCompany(null)} disabled={deleteTestCompanyState.isLoading}>{copy.cancel}</button><button type="button" className="is-danger" onClick={confirmDeleteTestCompany} disabled={deleteTestCompanyState.isLoading}>{deleteTestCompanyState.isLoading?copy.deleting:copy.delete}</button></div></section></div> : null}
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

function Metric({ label, value, attention = false, onClick }) {
  const count = metricValue(value);
  return <button type="button" className={`platformAdminMetric${attention && count > 0 ? ' has-attention' : ''}`} onClick={onClick}><span className="platformAdminMetricLabel">{label}</span><strong>{count.toLocaleString()}</strong></button>;
}

function CompaniesTable({ companies, copy, language, onDeleteCompany, compact = false, onShowAll, search, onSearch, filter='all', onFilter, expandedCompany, onExpand }) {
  const filtered = companies.filter(company => {
    const status = String(company.subscriptionStatus || company.status || '').toUpperCase();
    if (filter === 'active') return status === 'ACTIVE';
    if (filter === 'trial') return status.includes('TRIAL');
    if (filter === 'attention') return Boolean(company.hasOverduePayment) || ['OVERDUE','PAST_DUE','EXPIRED','GRACE_PERIOD'].some(value => status.includes(value));
    if (filter === 'inactive') return !status || status === 'INACTIVE';
    return true;
  });
  const visible = compact ? filtered.slice(0, 5) : filtered;
  return <section className={`platformAdminCompanies${compact ? ' is-compact' : ''}`}>
    <header><div><p className="sectionEyebrow">{copy.platform}</p><h2>{compact ? copy.recentCompanies : copy.companyList}</h2></div>{compact ? <button type="button" onClick={onShowAll}>{copy.viewAll} <span aria-hidden="true">→</span></button> : <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={copy.searchCompanies} aria-label={copy.companies} />}</header>
    {!compact ? <nav className="platformAdminFilters" aria-label={copy.status}>{Object.entries(copy.filters).map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} className={filter===key?'is-active':''} onClick={()=>onFilter(key)}>{label}</button>)}</nav> : null}
    {!visible.length ? <div className="platformAdminEmpty">{companies.length ? copy.noResults : copy.empty}{filter!=='all'||search?<button type="button" onClick={()=>{onFilter('all');onSearch('');}}>{copy.clearFilter}</button>:null}</div> : <div className="platformAdminCompanyList">{visible.map(company => {
      const status = company.subscriptionStatus || company.status;
      const isTrial = String(status || '').toUpperCase().includes('TRIAL');
      const isCodexTestCompany = /^Codex (?:Audit|Payload|Final|Compact) \d{13}$/.test(company.name || '');
      return <article key={company.id} className="platformAdminCompany">
        <div className="platformAdminCompanyName"><span className="platformAdminCompanyAvatar" aria-hidden="true">{String(company.name || '?').trim().slice(0, 1).toUpperCase()}</span><span><strong>{company.name || copy.unknown}</strong><small>{company.managerName || company.managerEmail || '—'}</small></span></div>
        <div className="platformAdminCompanyEmployees"><strong>{metricValue(company.activeEmployees)}</strong><small>{copy.employees.toLowerCase()}</small></div>
        <div className="platformAdminCompanyPlan"><strong>{company.planCode || '—'}</strong><small>{copy.plan}</small></div>
        <div className="platformAdminCompanyStatus"><span className={`platformAdminStatus is-${String(status || 'inactive').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{statusText(status, copy)}</span><small>{isTrial ? copy.trialUntil : copy.periodUntil}: {formatDate(isTrial ? company.trialEndsAt : company.currentPeriodEnd, language)}</small></div>
        <button className="platformAdminCompanyToggle" type="button" aria-expanded={expandedCompany===company.id} onClick={()=>onExpand(expandedCompany===company.id?null:company.id)}>{expandedCompany===company.id?copy.close:copy.details}<span aria-hidden="true">{expandedCompany===company.id?'−':'+'}</span></button>
        {expandedCompany===company.id?<div className="platformAdminCompanyDetails"><span><small>{copy.manager}</small><strong>{company.managerName||company.managerEmail||'—'}</strong></span><span><small>{copy.status}</small><strong>{statusText(status,copy)}</strong></span><span><small>{copy.plan}</small><strong>{company.planCode||'—'}</strong></span><span><small>{isTrial?copy.trialUntil:copy.periodUntil}</small><strong>{formatDate(isTrial?company.trialEndsAt:company.currentPeriodEnd,language)}</strong></span>{isCodexTestCompany?<div className="platformAdminTestCompanyAction"><p>{copy.deleteTestHint}</p><button type="button" onClick={()=>onDeleteCompany?.(company)}>{copy.deleteTestCompany}</button></div>:null}</div>:null}
      </article>;
    })}</div>}
  </section>;
}
