import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './ProvidersInfoPage.css';

const workflowItems = [
  { icon: 'plus', titleKey: 'stepCreateTitle', copyKey: 'stepCreateCopy' },
  { icon: 'check-circle', titleKey: 'stepSelectTitle', copyKey: 'stepSelectCopy' },
  { icon: 'file', titleKey: 'stepDocsTitle', copyKey: 'stepDocsCopy' },
];

const benefitItems = [
  { icon: 'invoice', titleKey: 'benefitProfilesTitle', copyKey: 'benefitProfilesCopy' },
  { icon: 'card', titleKey: 'benefitDocumentsTitle', copyKey: 'benefitDocumentsCopy' },
  { icon: 'send', titleKey: 'benefitDispatchTitle', copyKey: 'benefitDispatchCopy' },
];

export function ProvidersInfoPage() {
  const { t } = useI18n();

  return (
    <section className="providersInfoPage pageStack">
      <header className="providersInfoPage-header">
        <BackButton to="/" />
      </header>

      <section className="providersInfoPage-hero" aria-labelledby="providers-info-page-title">
        <div className="providersInfoPage-heroContent">
          <span className="providersInfoPage-eyebrow">
            <SvgIcon name="invoice" />
            {t('providersInfo.eyebrow')}
          </span>
          <h1 id="providers-info-page-title">{t('providersInfo.title')}</h1>
          <p>{t('providersInfo.subtitle')}</p>

          <div className="providersInfoPage-heroStats" aria-label={t('providersInfo.statsLabel')}>
            <span>
              <strong>{t('providersInfo.statProfilesValue')}</strong>
              {t('providersInfo.statProfilesLabel')}
            </span>
            <span>
              <strong>{t('providersInfo.statDocsValue')}</strong>
              {t('providersInfo.statDocsLabel')}
            </span>
          </div>

          <Link className="providersInfoPage-primaryCta" to="/settings/providers">
            {t('providersInfo.openProvidersCta')}
            <SvgIcon name="chevron-right" />
          </Link>
        </div>

        <div className="providersInfoPage-visual" aria-hidden="true">
          <span className="providersInfoPage-document">
            <SvgIcon name="invoice" />
          </span>
          <span className="providersInfoPage-detail providersInfoPage-detail--address">
            <SvgIcon name="location" />
          </span>
          <span className="providersInfoPage-detail providersInfoPage-detail--ico">
            <SvgIcon name="card" />
          </span>
          <span className="providersInfoPage-detail providersInfoPage-detail--dic">
            <SvgIcon name="file" />
          </span>
          <span className="providersInfoPage-route providersInfoPage-route--top" />
          <span className="providersInfoPage-route providersInfoPage-route--bottom" />
        </div>
      </section>

      <section className="providersInfoPage-section">
        <div className="providersInfoPage-sectionHeader">
          <span>{t('providersInfo.workflowEyebrow')}</span>
          <h2>{t('providersInfo.workflowTitle')}</h2>
        </div>

        <div className="providersInfoPage-workflow">
          {workflowItems.map(item => (
            <article className="providersInfoPage-step" key={item.titleKey}>
              <span className="providersInfoPage-stepIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`providersInfo.${item.titleKey}`)}</strong>
              <p>{t(`providersInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="providersInfoPage-benefits" aria-labelledby="providers-info-benefits-title">
        <div className="providersInfoPage-sectionHeader">
          <span>{t('providersInfo.benefitsEyebrow')}</span>
          <h2 id="providers-info-benefits-title">{t('providersInfo.benefitsTitle')}</h2>
        </div>

        <div className="providersInfoPage-benefitGrid">
          {benefitItems.map(item => (
            <article className="providersInfoPage-benefit" key={item.titleKey}>
              <span className="providersInfoPage-benefitIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`providersInfo.${item.titleKey}`)}</strong>
              <p>{t(`providersInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="providersInfoPage-finalCta">
        <div>
          <span>{t('providersInfo.finalEyebrow')}</span>
          <h2>{t('providersInfo.finalTitle')}</h2>
          <p>{t('providersInfo.finalCopy')}</p>
        </div>
        <Link className="providersInfoPage-primaryCta" to="/settings/providers">
          {t('providersInfo.openProvidersCta')}
          <SvgIcon name="chevron-right" />
        </Link>
      </section>
    </section>
  );
}
