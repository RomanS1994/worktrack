import { useMemo } from 'react';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetManagerEmployeesQuery, useGetManagerSubmissionsQuery } from '../../features/worktrack/worktrackApi.js';
import './ApprovalHistoryPage.css';

const LOCALES = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };
const COPY = {
  uk: { eyebrow:'Контроль',title:'Історія погоджень',copy:'Хто і коли погодив або повернув години.',loading:'Завантажуємо історію…',empty:'Історія поки порожня',emptyCopy:'Після першого погодження або відхилення воно з’явиться тут.',approved:'Погоджено',rejected:'Повернено',reviewedBy:'Перевірив',submitted:'Подано',reviewed:'Перевірено',hours:'год',unknown:'Менеджер',employee:'Працівник' },
  cs: { eyebrow:'Kontrola',title:'Historie schválení',copy:'Kdo a kdy schválil nebo vrátil hodiny.',loading:'Načítáme historii…',empty:'Historie je zatím prázdná',emptyCopy:'Po prvním schválení nebo zamítnutí se záznam zobrazí zde.',approved:'Schváleno',rejected:'Vráceno',reviewedBy:'Zkontroloval',submitted:'Odesláno',reviewed:'Zkontrolováno',hours:'h',unknown:'Manažer',employee:'Pracovník' },
  en: { eyebrow:'Control',title:'Approval history',copy:'Who approved or returned hours and when.',loading:'Loading history…',empty:'No approval history yet',emptyCopy:'Approved or rejected weeks will appear here.',approved:'Approved',rejected:'Returned',reviewedBy:'Reviewed by',submitted:'Submitted',reviewed:'Reviewed',hours:'h',unknown:'Manager',employee:'Employee' },
};

function employeeName(submission, fallback) {
  return submission?.employee?.name || submission?.employee?.email || fallback;
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle:'medium', timeStyle:'short' }).format(date);
}

function formatPeriod(submission, locale) {
  const start = submission?.weekStart ? new Date(`${submission.weekStart}T00:00:00.000Z`) : null;
  const end = submission?.weekEnd ? new Date(`${submission.weekEnd}T00:00:00.000Z`) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const formatter = new Intl.DateTimeFormat(locale, { day:'numeric', month:'short', timeZone:'UTC' });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function ApprovalHistoryPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;
  const locale = LOCALES[language] || LOCALES.uk;
  const submissionsQuery = useGetManagerSubmissionsQuery({ status:'ALL' });
  const employeesQuery = useGetManagerEmployeesQuery();
  const employees = Array.isArray(employeesQuery.data?.employees) ? employeesQuery.data.employees : [];
  const reviewerById = useMemo(() => new Map(employees.map(item => [item.id, item.name || item.email || c.unknown])), [employees, c.unknown]);
  const history = useMemo(() => {
    const rows = Array.isArray(submissionsQuery.data?.submissions) ? submissionsQuery.data.submissions : [];
    return rows
      .filter(item => ['APPROVED','REJECTED'].includes(String(item.status || '').toUpperCase()))
      .sort((a,b) => String(b.reviewedAt || b.updatedAt || '').localeCompare(String(a.reviewedAt || a.updatedAt || '')));
  }, [submissionsQuery.data]);
  const loading = submissionsQuery.isLoading || employeesQuery.isLoading;
  const error = submissionsQuery.error || employeesQuery.error;

  return <section className="approvalHistoryPage pageStack">
    <header className="appTop approvalHistoryHeader"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.copy}</p></div></header>
    {loading ? <RequestLoadingState label={c.loading}/> : null}
    {error ? <p className="statusNote is-error">{getApiErrorMessage(error)}</p> : null}
    {!loading && !error && !history.length ? <section className="screenCard approvalHistoryEmpty"><span><SvgIcon name="check-circle"/></span><div><strong>{c.empty}</strong><p>{c.emptyCopy}</p></div></section> : null}
    {!loading && !error && history.length ? <div className="approvalHistoryList">{history.map(item => {
      const approved = item.status === 'APPROVED';
      const reviewer = reviewerById.get(item.reviewedByMembershipId) || c.unknown;
      return <article className="screenCard approvalHistoryItem" key={item.id}>
        <div className="approvalHistoryTop"><span className={`approvalHistoryStatus ${approved?'is-approved':'is-rejected'}`}><i aria-hidden="true"/>{approved?c.approved:c.rejected}</span><strong>{Number(item.summary?.totalHours || 0).toFixed(2)} {c.hours}</strong></div>
        <div className="approvalHistoryMain"><div className="approvalHistoryAvatar" aria-hidden="true">{employeeName(item,c.employee).slice(0,1).toUpperCase()}</div><div><strong>{employeeName(item,c.employee)}</strong><span>{formatPeriod(item,locale)}</span></div></div>
        <div className="approvalHistoryMeta"><span><small>{c.reviewedBy}</small><strong>{reviewer}</strong></span><span><small>{c.reviewed}</small><strong>{formatDate(item.reviewedAt,locale)}</strong></span><span><small>{c.submitted}</small><strong>{formatDate(item.submittedAt,locale)}</strong></span></div>
        {item.status === 'REJECTED' && item.rejectionReason ? <p className="approvalHistoryReason">{item.rejectionReason}</p> : null}
      </article>;
    })}</div> : null}
  </section>;
}
