import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './ProvidersPromo.css';

const features = [
  {
    icon: 'accounts',
    titleKey: 'providersPromoFeatureProfilesTitle',
  },
  {
    icon: 'check-circle',
    titleKey: 'providersPromoFeatureDefaultTitle',
  },
  {
    icon: 'file',
    titleKey: 'providersPromoFeatureDocsTitle',
  },
];

export function ProvidersPromo() {
  const { t } = useI18n();

  return (
    <section className="providersPromo" aria-labelledby="providers-promo-title">
      <div className="providersPromo-content">
        <div className="providersPromo-intro">
          <p className="providersPromo-eyebrow">{t('home.providersPromoEyebrow')}</p>
          <h2 id="providers-promo-title">{t('home.providersPromoTitle')}</h2>
          <p className="providersPromo-copy">{t('home.providersPromoSubtitle')}</p>
        </div>

        <ul className="providersPromo-features" aria-label={t('home.providersPromoFeaturesLabel')}>
          {features.map(feature => (
            <li key={feature.titleKey}>
              <span className="providersPromo-featureIcon" aria-hidden="true">
                <SvgIcon name={feature.icon} />
              </span>
              <strong>{t(`home.${feature.titleKey}`)}</strong>
            </li>
          ))}
        </ul>

        <div className="providersPromo-cta">
          <span className="providersPromo-ctaIcon" aria-hidden="true">
            <SvgIcon name="invoice" />
          </span>
          <strong>{t('home.providersPromoBenefit')}</strong>
          <Link className="providersPromo-button" to="/providers-info">
            {t('home.providersPromoLearnMore')}
            <SvgIcon name="chevron-right" />
          </Link>
        </div>
      </div>

      <div className="providersPromo-visual" aria-hidden="true">
        <span className="providersPromo-card providersPromo-card--main">
          <SvgIcon name="invoice" />
        </span>
        <span className="providersPromo-card providersPromo-card--address">
          <SvgIcon name="location" />
        </span>
        <span className="providersPromo-card providersPromo-card--id">
          <SvgIcon name="card" />
        </span>
        <span className="providersPromo-line providersPromo-line--one" />
        <span className="providersPromo-line providersPromo-line--two" />
      </div>
    </section>
  );
}
