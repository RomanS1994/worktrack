import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PartnerProgramsPage.css';

const COPY = {
  uk: { title: 'Партнерські програми', copy: 'Корисні інструменти для вашої роботи', materials: 'Матеріали', partner: 'Партнер', heading: 'Облік сантехнічних матеріалів', pipeCopy: 'Ведіть облік труб, фітингів і залишків, створюйте замовлення та контролюйте матеріали на об’єктах.', features: ['Матеріали та залишки', 'Замовлення на об’єкти', 'Звіти та історія'], open: 'Відкрити PipeStock', hint: 'Відкривається всередині WorkTrack', photoAlt: 'Мідні труби та сантехнічні фітинги' },
  cs: { title: 'Partnerské programy', copy: 'Užitečné nástroje pro vaši práci', materials: 'Materiál', partner: 'Partner', heading: 'Evidence instalatérského materiálu', pipeCopy: 'Evidujte trubky, tvarovky a zásoby, vytvářejte objednávky a sledujte materiál na stavbách.', features: ['Materiál a zásoby', 'Objednávky na stavby', 'Přehledy a historie'], open: 'Otevřít PipeStock', hint: 'Otevře se uvnitř WorkTrack', photoAlt: 'Měděné trubky a instalatérské tvarovky' },
  en: { title: 'Partner programs', copy: 'Useful tools for your work', materials: 'Materials', partner: 'Partner', heading: 'Plumbing materials tracking', pipeCopy: 'Track pipes, fittings and stock, create orders and manage materials across job sites.', features: ['Materials and stock', 'Job-site orders', 'Reports and history'], open: 'Open PipeStock', hint: 'Opens inside WorkTrack', photoAlt: 'Copper pipes and plumbing fittings' },
};

const PIPESTOCK_PHOTO = 'https://pipestock.netlify.app/onboarding/copper-detail.webp';

function PipeIcon() {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 45V34c0-13 10-23 23-23h8"/><path d="M10 34h12c0-6 5-11 11-11h8"/><rect x="6" y="43" width="22" height="10" rx="2"/><rect x="40" y="6" width="10" height="23" rx="2"/></svg>;
}

function FeatureIcon({ type }) {
  if (type === 'box') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></svg>;
  if (type === 'order') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M5 20v-7M12 20V8M19 20V3"/></svg>;
}

export function PartnerProgramsPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;
  return <section className="partnerProgramsPage pageStack">
    <header className="partnerProgramsHeader appTop"><BackButton to="/dashboard"/><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>
    <section className="partnerProgramsHero screenCard" aria-labelledby="pipestock-title">
      <div className="partnerProgramsVisual">
        <div className="partnerProgramsPhoto"><img src={PIPESTOCK_PHOTO} alt={c.photoAlt} loading="lazy" decoding="async" /></div>
        <div className="partnerProgramsIdentity">
          <span className="partnerProgramsHeroIcon"><PipeIcon /></span>
          <div className="partnerProgramsName"><h2 id="pipestock-title">Pipe<span>Stock</span></h2><small className="partnerProgramsBadge">{c.partner}</small></div>
        </div>
        <div className="partnerProgramsIntro"><span className="partnerProgramsEyebrow">{c.materials}</span><h3>{c.heading}</h3><p>{c.pipeCopy}</p></div>
      </div>
      <div className="partnerProgramsFeatures">{c.features.map((feature, index) => <div key={feature}><span className="partnerProgramsFeatureIcon"><FeatureIcon type={['box', 'order', 'report'][index]} /></span><span>{feature}</span></div>)}</div>
      <Link className="partnerProgramsOpen" to="/pipestock?from=worktrack" reloadDocument>{c.open}<span aria-hidden="true">→</span></Link>
      <p className="partnerProgramsHint"><span aria-hidden="true">↗</span> {c.hint}</p>
    </section>
  </section>;
}
