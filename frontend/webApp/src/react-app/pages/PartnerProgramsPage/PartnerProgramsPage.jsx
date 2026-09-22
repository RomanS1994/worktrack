import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PartnerProgramsPage.css';

const COPY = {
  uk: { title: 'Партнерські програми', copy: 'Окремі робочі інструменти, які доповнюють WorkTrack.', materials: 'Матеріали', partner: 'Партнер', pipeCopy: 'Ведіть облік труб, фітингів і залишків, створюйте замовлення та контролюйте матеріали на об’єктах.', features: ['Матеріали та залишки', 'Замовлення на об’єкти', 'Звіти та історія'], open: 'Відкрити PipeStock', hint: 'Відкривається всередині WorkTrack.', photoAlt: 'Мідні труби та сантехнічні фітинги' },
  cs: { title: 'Partnerské programy', copy: 'Samostatné pracovní nástroje, které doplňují WorkTrack.', materials: 'Materiál', partner: 'Partner', pipeCopy: 'Evidujte trubky, tvarovky a zásoby, vytvářejte objednávky a sledujte materiál na stavbách.', features: ['Materiál a zásoby', 'Objednávky na stavby', 'Přehledy a historie'], open: 'Otevřít PipeStock', hint: 'Otevře se uvnitř WorkTrack.', photoAlt: 'Měděné trubky a instalatérské tvarovky' },
  en: { title: 'Partner programs', copy: 'Separate work tools that extend WorkTrack.', materials: 'Materials', partner: 'Partner', pipeCopy: 'Track pipes, fittings and stock, create orders and manage materials across job sites.', features: ['Materials and stock', 'Job-site orders', 'Reports and history'], open: 'Open PipeStock', hint: 'Opens inside WorkTrack.', photoAlt: 'Copper pipes and plumbing fittings' },
};

// Reuse the real PipeStock onboarding photo rather than embedding a screenshot of the UI.
const PIPESTOCK_PHOTO = 'https://pipestock.netlify.app/onboarding/copper-detail.webp';

function PipeIcon() {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 50V37c0-14 11-25 25-25h14"/><path d="M12 37h12c0-7 6-13 13-13h14"/><rect x="6" y="46" width="23" height="11" rx="3"/><rect x="46" y="6" width="11" height="23" rx="3"/></svg>;
}

export function PartnerProgramsPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;
  return <section className="partnerProgramsPage pageStack">
    <header className="partnerProgramsHeader appTop"><BackButton to="/dashboard"/><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>
    <section className="partnerProgramsHero screenCard" aria-labelledby="pipestock-title">
      <div className="partnerProgramsIdentity">
        <span className="partnerProgramsHeroIcon"><PipeIcon /></span>
        <div className="partnerProgramsName"><h2 id="pipestock-title">Pipe<span>Stock</span></h2><small>{c.materials}</small></div>
        <span className="partnerProgramsBadge">{c.partner}</span>
      </div>
      <div className="partnerProgramsPhoto"><img src={PIPESTOCK_PHOTO} alt={c.photoAlt} loading="lazy" decoding="async" /></div>
      <div className="partnerProgramsIntro"><h3>{c.materials}</h3><p>{c.pipeCopy}</p></div>
      <div className="partnerProgramsFeatures">{c.features.map((feature, index) => <div key={feature}><span aria-hidden="true">{index === 0 ? '▣' : index === 1 ? '▤' : '▥'}</span><span>{feature}</span></div>)}</div>
      <Link className="partnerProgramsOpen" to="/pipestock?from=worktrack" reloadDocument>{c.open}<span aria-hidden="true">↗</span></Link>
      <p className="partnerProgramsHint">{c.hint}</p>
    </section>
  </section>;
}
