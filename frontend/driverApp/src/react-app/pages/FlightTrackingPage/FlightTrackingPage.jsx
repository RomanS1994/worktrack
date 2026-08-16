import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import planePhoto from '../../assets/flight-tracking-plane.png';
import './FlightTrackingPage.css';

const workflowItems = [
  { icon: 'orders', titleKey: 'stepOrderTitle', copyKey: 'stepOrderCopy' },
  { icon: 'takeoff', titleKey: 'stepTrackingTitle', copyKey: 'stepTrackingCopy' },
  { icon: 'clock', titleKey: 'stepPickupTitle', copyKey: 'stepPickupCopy' },
];

const benefitItems = [
  { icon: 'check-circle', titleKey: 'benefitDelayTitle', copyKey: 'benefitDelayCopy' },
  { icon: 'location', titleKey: 'benefitPickupTitle', copyKey: 'benefitPickupCopy' },
  { icon: 'route', titleKey: 'benefitOrderTitle', copyKey: 'benefitOrderCopy' },
];

export function FlightTrackingPage() {
  const { t } = useI18n();

  return (
    <section className="flightTrackingPage pageStack">
      <header className="flightTrackingPage-header">
        <BackButton to="/" />
      </header>

      <section className="flightTrackingPage-hero" aria-labelledby="flight-tracking-page-title">
        <img className="flightTrackingPage-heroImage" src={planePhoto} alt="" />
        <div className="flightTrackingPage-heroContent">
          <span className="flightTrackingPage-eyebrow">
            <SvgIcon name="crown" />
            {t('flightTrackingInfo.eyebrow')}
          </span>
          <h1 id="flight-tracking-page-title">{t('flightTrackingInfo.title')}</h1>
          <p>{t('flightTrackingInfo.subtitle')}</p>

          <div className="flightTrackingPage-heroStats" aria-label={t('flightTrackingInfo.statsLabel')}>
            <span>
              <strong>{t('flightTrackingInfo.statLiveValue')}</strong>
              {t('flightTrackingInfo.statLiveLabel')}
            </span>
            <span>
              <strong>{t('flightTrackingInfo.statPickupValue')}</strong>
              {t('flightTrackingInfo.statPickupLabel')}
            </span>
          </div>

          <Link className="flightTrackingPage-primaryCta" to="/settings/plan-upgrade">
            {t('flightTrackingInfo.upgradeCta')}
            <SvgIcon name="chevron-right" />
          </Link>
        </div>
      </section>

      <section className="flightTrackingPage-section">
        <div className="flightTrackingPage-sectionHeader">
          <span>{t('flightTrackingInfo.workflowEyebrow')}</span>
          <h2>{t('flightTrackingInfo.workflowTitle')}</h2>
        </div>

        <div className="flightTrackingPage-workflow">
          {workflowItems.map(item => (
            <article className="flightTrackingPage-step" key={item.titleKey}>
              <span className="flightTrackingPage-stepIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`flightTrackingInfo.${item.titleKey}`)}</strong>
              <p>{t(`flightTrackingInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flightTrackingPage-benefits" aria-labelledby="flight-tracking-benefits-title">
        <div className="flightTrackingPage-sectionHeader">
          <span>{t('flightTrackingInfo.benefitsEyebrow')}</span>
          <h2 id="flight-tracking-benefits-title">{t('flightTrackingInfo.benefitsTitle')}</h2>
        </div>

        <div className="flightTrackingPage-benefitGrid">
          {benefitItems.map(item => (
            <article className="flightTrackingPage-benefit" key={item.titleKey}>
              <span className="flightTrackingPage-benefitIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`flightTrackingInfo.${item.titleKey}`)}</strong>
              <p>{t(`flightTrackingInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flightTrackingPage-finalCta">
        <div>
          <span>{t('flightTrackingInfo.finalEyebrow')}</span>
          <h2>{t('flightTrackingInfo.finalTitle')}</h2>
          <p>{t('flightTrackingInfo.finalCopy')}</p>
        </div>
        <Link className="flightTrackingPage-primaryCta" to="/settings/plan-upgrade">
          {t('flightTrackingInfo.upgradeCta')}
          <SvgIcon name="chevron-right" />
        </Link>
      </section>
    </section>
  );
}
