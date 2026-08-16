import { useI18n } from '@shared/app/i18n/useI18n.js';
import './StatsTabs.css';

export function StatsTabs({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="statsTabs" role="tablist" aria-label={t('stats.title')}>
      <button
        className={`statsTab ${value === 'usage' ? 'is-active' : ''}`}
        type="button"
        onClick={() => onChange('usage')}
      >
        {t('stats.usage')}
      </button>
      <button
        className={`statsTab ${value === 'salary' ? 'is-active' : ''}`}
        type="button"
        onClick={() => onChange('salary')}
      >
        {t('stats.salary')}
      </button>
      <button
        className={`statsTab ${value === 'activity' ? 'is-active' : ''}`}
        type="button"
        onClick={() => onChange('activity')}
      >
        {t('stats.activity')}
      </button>
    </div>
  );
}
