import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './TeamCollaborationPage.css';

const workflowItems = [
  { icon: 'send', titleKey: 'stepAssignTitle', copyKey: 'stepAssignCopy' },
  { icon: 'shield-star', titleKey: 'stepControlTitle', copyKey: 'stepControlCopy' },
  { icon: 'clock', titleKey: 'stepHistoryTitle', copyKey: 'stepHistoryCopy' },
];

const benefitItems = [
  { icon: 'accounts', titleKey: 'benefitTeamTitle', copyKey: 'benefitTeamCopy' },
  { icon: 'check-circle', titleKey: 'benefitStatusTitle', copyKey: 'benefitStatusCopy' },
  { icon: 'orders', titleKey: 'benefitOrdersTitle', copyKey: 'benefitOrdersCopy' },
];

export function TeamCollaborationPage() {
  const { t } = useI18n();

  return (
    <section className="teamCollaborationPage pageStack">
      <header className="teamCollaborationPage-header">
        <BackButton to="/" />
      </header>

      <section className="teamCollaborationPage-hero" aria-labelledby="team-collaboration-page-title">
        <div className="teamCollaborationPage-heroContent">
          <span className="teamCollaborationPage-eyebrow">
            <SvgIcon name="crown" />
            {t('teamCollaborationInfo.eyebrow')}
          </span>
          <h1 id="team-collaboration-page-title">{t('teamCollaborationInfo.title')}</h1>
          <p>{t('teamCollaborationInfo.subtitle')}</p>

          <div className="teamCollaborationPage-heroStats" aria-label={t('teamCollaborationInfo.statsLabel')}>
            <span>
              <strong>{t('teamCollaborationInfo.statMembersValue')}</strong>
              {t('teamCollaborationInfo.statMembersLabel')}
            </span>
            <span>
              <strong>{t('teamCollaborationInfo.statLiveValue')}</strong>
              {t('teamCollaborationInfo.statLiveLabel')}
            </span>
          </div>

          <Link className="teamCollaborationPage-primaryCta" to="/settings/team">
            {t('teamCollaborationInfo.openTeamCta')}
            <SvgIcon name="chevron-right" />
          </Link>
        </div>

        <div className="teamCollaborationPage-visual" aria-hidden="true">
          <span className="teamCollaborationPage-ring teamCollaborationPage-ring--outer" />
          <span className="teamCollaborationPage-ring teamCollaborationPage-ring--inner" />
          <span className="teamCollaborationPage-route teamCollaborationPage-route--topLeft" />
          <span className="teamCollaborationPage-route teamCollaborationPage-route--topRight" />
          <span className="teamCollaborationPage-route teamCollaborationPage-route--bottomLeft" />
          <span className="teamCollaborationPage-route teamCollaborationPage-route--bottomRight" />
          <span className="teamCollaborationPage-hub"><SvgIcon name="user" /></span>
          <span className="teamCollaborationPage-node teamCollaborationPage-node--top"><SvgIcon name="user" /></span>
          <span className="teamCollaborationPage-node teamCollaborationPage-node--right"><SvgIcon name="user" /></span>
          <span className="teamCollaborationPage-node teamCollaborationPage-node--bottom"><SvgIcon name="user" /></span>
          <span className="teamCollaborationPage-tool teamCollaborationPage-tool--send"><SvgIcon name="send" /></span>
          <span className="teamCollaborationPage-tool teamCollaborationPage-tool--shield"><SvgIcon name="shield-star" /></span>
        </div>
      </section>

      <section className="teamCollaborationPage-section">
        <div className="teamCollaborationPage-sectionHeader">
          <span>{t('teamCollaborationInfo.workflowEyebrow')}</span>
          <h2>{t('teamCollaborationInfo.workflowTitle')}</h2>
        </div>

        <div className="teamCollaborationPage-workflow">
          {workflowItems.map(item => (
            <article className="teamCollaborationPage-step" key={item.titleKey}>
              <span className="teamCollaborationPage-stepIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`teamCollaborationInfo.${item.titleKey}`)}</strong>
              <p>{t(`teamCollaborationInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="teamCollaborationPage-benefits" aria-labelledby="team-collaboration-benefits-title">
        <div className="teamCollaborationPage-sectionHeader">
          <span>{t('teamCollaborationInfo.benefitsEyebrow')}</span>
          <h2 id="team-collaboration-benefits-title">{t('teamCollaborationInfo.benefitsTitle')}</h2>
        </div>

        <div className="teamCollaborationPage-benefitGrid">
          {benefitItems.map(item => (
            <article className="teamCollaborationPage-benefit" key={item.titleKey}>
              <span className="teamCollaborationPage-benefitIcon" aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <strong>{t(`teamCollaborationInfo.${item.titleKey}`)}</strong>
              <p>{t(`teamCollaborationInfo.${item.copyKey}`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="teamCollaborationPage-finalCta">
        <div>
          <span>{t('teamCollaborationInfo.finalEyebrow')}</span>
          <h2>{t('teamCollaborationInfo.finalTitle')}</h2>
          <p>{t('teamCollaborationInfo.finalCopy')}</p>
        </div>
        <Link className="teamCollaborationPage-primaryCta" to="/settings/team">
          {t('teamCollaborationInfo.openTeamCta')}
          <SvgIcon name="chevron-right" />
        </Link>
      </section>
    </section>
  );
}
