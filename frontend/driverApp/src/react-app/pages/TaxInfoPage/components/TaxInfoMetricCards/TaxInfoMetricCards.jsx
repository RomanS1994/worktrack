import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TaxInfoMetricCards.css';

export function TaxInfoMetricCards({ stats }) {
  const { t } = useI18n();

  return (
    <section className="taxInfoMetrics" aria-label={t('settings.taxInfo.metricsTitle')}>
      {stats.map(stat => (
        <article className={`taxInfoMetric taxInfoMetric--${stat.tone}`} key={stat.id}>
          <span className="taxInfoMetric-title">{t(`settings.taxInfo.metrics.${stat.id}.title`)}</span>
          <strong>{stat.value}</strong>
          <span className="taxInfoMetric-copy">{t(`settings.taxInfo.metrics.${stat.id}.copy`)}</span>
        </article>
      ))}
    </section>
  );
}
