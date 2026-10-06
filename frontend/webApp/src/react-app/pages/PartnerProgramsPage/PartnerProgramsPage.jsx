import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PartnerProgramsPage.css';

const COPY = {
  uk: {
    title: 'Партнерські програми',
    copy: 'Корисні інструменти для вашої роботи',
    partner: 'Партнер',
    heading: 'Облік матеріалів',
    pipeCopy: 'Матеріали, замовлення та історія робіт — прямо на об’єкті.',
    features: ['Матеріали', 'Замовлення', 'Історія'],
    open: 'Відкрити PipeStock',
    photoAlt: 'Мідні труби та сантехнічні фітинги',
  },
  cs: {
    title: 'Partnerské programy',
    copy: 'Užitečné nástroje pro vaši práci',
    partner: 'Partner',
    heading: 'Evidence materiálu',
    pipeCopy: 'Materiál, objednávky a historie práce — přímo na stavbě.',
    features: ['Materiál', 'Objednávky', 'Historie'],
    open: 'Otevřít PipeStock',
    photoAlt: 'Měděné trubky a instalatérské tvarovky',
  },
  en: {
    title: 'Partner programs',
    copy: 'Useful tools for your work',
    partner: 'Partner',
    heading: 'Materials tracking',
    pipeCopy: 'Materials, orders and work history — right on the job site.',
    features: ['Materials', 'Orders', 'History'],
    open: 'Open PipeStock',
    photoAlt: 'Copper pipes and plumbing fittings',
  },
};

const PIPESTOCK_PHOTO = 'https://pipestock.netlify.app/onboarding/copper-installation-v2.webp';

function PipeIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 12v16c0 10 8 18 18 18h16" />
      <path d="M12 12h12M12 20h12M44 40v12M52 40v12" />
      <path d="M18 28c0 10 8 18 18 18" opacity=".7" />
    </svg>
  );
}

function FeatureIcon({ type }) {
  if (type === 'box') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
        <path d="M4 7.5V16l8 5 8-5V7.5M12 12v9" />
      </svg>
    );
  }
  if (type === 'order') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3 21h18" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export function PartnerProgramsPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;

  return <section className="partnerProgramsPage pageStack">
    <header className="partnerProgramsHeader appTop">
      <BackButton to="/dashboard"/>
      <div className="appTitleBlock">
        <h1>{c.title}</h1>
        <p>{c.copy}</p>
      </div>
    </header>

    <section className="partnerProgramsHero screenCard" aria-labelledby="pipestock-title">
      <div className="partnerProgramsVisual">
        <div className="partnerProgramsPhoto">
          <img src={PIPESTOCK_PHOTO} alt={c.photoAlt} loading="lazy" decoding="async" />
        </div>

        <div className="partnerProgramsIdentity">
          <span className="partnerProgramsHeroIcon"><PipeIcon /></span>
          <div className="partnerProgramsName">
            <h2 id="pipestock-title">Pipe<span>Stock</span></h2>
            <small className="partnerProgramsBadge">{c.partner}</small>
          </div>
        </div>

        <div className="partnerProgramsIntro">
          <h3>{c.heading}</h3>
          <p>{c.pipeCopy}</p>
        </div>
      </div>

      <div className="partnerProgramsFeatures">
        {c.features.map((feature, index) => (
          <div key={feature}>
            <span className="partnerProgramsFeatureIcon">
              <FeatureIcon type={['box', 'order', 'report'][index]} />
            </span>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <Link className="partnerProgramsOpen" to="/pipestock?from=worktrack" reloadDocument>
        {c.open}
        <span className="partnerProgramsOpenIcon"><ArrowRightIcon /></span>
      </Link>
    </section>
  </section>;
}
