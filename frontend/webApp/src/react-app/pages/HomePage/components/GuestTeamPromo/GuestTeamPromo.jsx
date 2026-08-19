import { Link } from 'react-router-dom';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './GuestTeamPromo.css';

const features = [
  {
    icon: 'send',
    titleKey: 'sendTitle',
  },
  {
    icon: 'shield-star',
    titleKey: 'controlTitle',
  },
];

export function GuestTeamPromo() {
  const { t } = useI18n();

  return (
    <section className="guestTeamPromo" aria-labelledby="guest-team-promo-title">
      <div className="guestTeamPromo-content">
        <p className="guestTeamPromo-eyebrow">{t('guest.teamPromoEyebrow')}</p>
        <h2 id="guest-team-promo-title">{t('guest.teamPromoTitle')}</h2>
        <p className="guestTeamPromo-copy">{t('guest.teamPromoCopy')}</p>

        <ul className="guestTeamPromo-features" aria-label={t('guest.teamPromoFeaturesLabel')}>
          {features.map(feature => (
            <li key={feature.titleKey}>
              <span className="guestTeamPromo-featureIcon" aria-hidden="true">
                <SvgIcon name={feature.icon} />
              </span>
              <span>
                <strong>{t(`guest.teamPromoFeatures.${feature.titleKey}`)}</strong>
              </span>
            </li>
          ))}
        </ul>

        <Link className="guestTeamPromo-cta" to="/team-collaboration">
          <span>{t('guest.teamPromoCta')}</span>
          <SvgIcon name="chevron-right" />
        </Link>
      </div>

      <div className="guestTeamPromo-visual" aria-hidden="true">
        <span className="guestTeamPromo-plan">
          <SvgIcon name="crown" />
          PLATINUM
        </span>
        <span className="guestTeamPromo-ring guestTeamPromo-ring--outer" />
        <span className="guestTeamPromo-ring guestTeamPromo-ring--inner" />
        <span className="guestTeamPromo-route guestTeamPromo-route--topLeft" />
        <span className="guestTeamPromo-route guestTeamPromo-route--topRight" />
        <span className="guestTeamPromo-route guestTeamPromo-route--bottomLeft" />
        <span className="guestTeamPromo-route guestTeamPromo-route--bottomRight" />

        <span className="guestTeamPromo-hub">
          <SvgIcon name="user" />
        </span>

        <span className="guestTeamPromo-member guestTeamPromo-member--topLeft">
          <SvgIcon name="user" />
        </span>
        <span className="guestTeamPromo-member guestTeamPromo-member--topRight">
          <SvgIcon name="user" />
        </span>
        <span className="guestTeamPromo-member guestTeamPromo-member--bottomLeft">
          <SvgIcon name="user" />
        </span>

        <span className="guestTeamPromo-tool guestTeamPromo-tool--file">
          <SvgIcon name="file" />
        </span>
        <span className="guestTeamPromo-tool guestTeamPromo-tool--shield">
          <SvgIcon name="shield-star" />
        </span>
      </div>
    </section>
  );
}
