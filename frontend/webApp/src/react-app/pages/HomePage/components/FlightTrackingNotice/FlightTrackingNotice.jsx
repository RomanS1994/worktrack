import { Link } from 'react-router-dom';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import planePhoto from '../../../../assets/flight-tracking-plane.png';
import './FlightTrackingNotice.css';

const features = [
  {
    icon: 'takeoff',
    titleKey: 'flightTrackingFeatureStatusTitle',
  },
  {
    icon: 'location',
    titleKey: 'flightTrackingFeaturePickupTitle',
  },
  {
    icon: 'orders',
    titleKey: 'flightTrackingFeatureOrderTitle',
  },
];

export function FlightTrackingNotice() {
  const { t } = useI18n();

  return (
    <section className="flightTrackingNotice" aria-labelledby="flight-tracking-notice-title">
      <div className="flightTrackingNotice-visual" aria-hidden="true">
        <img className="flightTrackingNotice-photo" src={planePhoto} alt="" />
        <span className="flightTrackingNotice-route" />
      </div>

      <span className="flightTrackingNotice-plan">
        <SvgIcon name="crown" />
        {t('home.flightTrackingPlan')}
      </span>

      <div className="flightTrackingNotice-main">
        <span className="flightTrackingNotice-heroIcon" aria-hidden="true">
          <SvgIcon name="takeoff" />
          <span />
        </span>

        <div className="flightTrackingNotice-copy">
          <span className="flightTrackingNotice-status">{t('home.flightTrackingStatus')}</span>
          <h2 id="flight-tracking-notice-title">{t('home.flightTrackingTitle')}</h2>
          <p className="flightTrackingNotice-subtitle">{t('home.flightTrackingSubtitle')}</p>
        </div>
      </div>

      <ul className="flightTrackingNotice-features" aria-label={t('home.flightTrackingFeaturesLabel')}>
        {features.map(feature => (
          <li key={feature.titleKey}>
            <span className="flightTrackingNotice-featureIcon" aria-hidden="true">
              <SvgIcon name={feature.icon} />
            </span>
            <strong>{t(`home.${feature.titleKey}`)}</strong>
          </li>
        ))}
      </ul>

      <div className="flightTrackingNotice-cta">
        <span className="flightTrackingNotice-ctaIcon" aria-hidden="true">
          <SvgIcon name="shield-star" />
        </span>
        <div className="flightTrackingNotice-ctaCopy">
          <strong>{t('home.flightTrackingBenefit')}</strong>
        </div>
        <div className="flightTrackingNotice-ctaAction">
          <Link className="flightTrackingNotice-button" to="/flight-tracking">
            {t('home.flightTrackingLearnMore')}
            <SvgIcon name="chevron-right" />
          </Link>
        </div>
      </div>
    </section>
  );
}
