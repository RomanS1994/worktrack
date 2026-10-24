import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { formatCzk, resolveLocale } from '../../app/formatters.js';
import { useGetEmployeeAdvancesQuery } from '../../features/worktrack/worktrackApi.js';
import './EmployeeAdvancesPage.css';

const COPY = {
  uk: { title: 'Історія залогів', description: 'Аванси, які менеджер записав для вас.', total: 'Усього отримано', entries: 'Записів', empty: 'Записів про залоги поки немає.', loading: 'Завантажуємо залоги…', note: 'Примітка менеджера' },
  cs: { title: 'Historie záloh', description: 'Zálohy, které vám manažer zaznamenal.', total: 'Celkem vyplaceno', entries: 'Záznamů', empty: 'Zatím zde nejsou žádné zálohy.', loading: 'Načítání záloh…', note: 'Poznámka manažera' },
  en: { title: 'Advance history', description: 'Advances recorded for you by your manager.', total: 'Total received', entries: 'Entries', empty: 'No advances have been recorded yet.', loading: 'Loading advances…', note: 'Manager note' },
};

function formatPaidAt(value, locale) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function EmployeeAdvancesPage() {
  const { language } = useI18n();
  const locale = resolveLocale(language);
  const copy = COPY[language] || COPY.uk;
  const query = useGetEmployeeAdvancesQuery();
  const advances = query.data?.advances || [];
  const total = Number(query.data?.summary?.totalCzk || 0);

  if (query.isLoading) return <section className="employeeAdvancesPage pageStack"><RequestLoadingState label={copy.loading} /></section>;

  return <section className="employeeAdvancesPage pageStack">
    <header className="employeeAdvances-heading">
      <div><h1>{copy.title}</h1><p>{copy.description}</p></div>
    </header>
    {query.error ? <p className="statusNote is-error">{getApiErrorMessage(query.error)}</p> : null}
    {!query.error ? <>
      <section className="employeeAdvances-summary" aria-label={copy.total}>
        <div><span>{copy.total}</span><strong>{formatCzk(total, locale)}</strong></div>
        <span className="employeeAdvances-count">{advances.length} {copy.entries.toLowerCase()}</span>
      </section>
      {advances.length ? <section className="employeeAdvances-list" aria-label={copy.title}>
        {advances.map(item => <article className="employeeAdvances-item" key={item.id}>
          <div className="employeeAdvances-itemTop"><div><span className="employeeAdvances-date">{formatPaidAt(item.paidAt, locale)}</span>{item.note ? <span className="employeeAdvances-noteLabel">{copy.note}</span> : null}</div><strong>− {formatCzk(item.amountCzk, locale)}</strong></div>
          {item.note ? <p className="employeeAdvances-note">{item.note}</p> : null}
        </article>)}
      </section> : <div className="employeeAdvances-empty">{copy.empty}</div>}
    </> : null}
  </section>;
}
