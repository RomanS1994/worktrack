import { Link } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import './PartnerProgramsPage.css';

const COPY={
  uk:{title:'Партнерські програми',copy:'Окремі робочі інструменти, які доповнюють WorkTrack.',materials:'Матеріали',pipeTitle:'PipeStock',pipeCopy:'Облік сантехнічних матеріалів, труб, фітингів і залишків для роботи на об’єктах.',open:'Відкрити PipeStock',back:'На головну',hint:'Відкриється всередині WorkTrack без Safari-панелей.'},
  cs:{title:'Partnerské programy',copy:'Samostatné pracovní nástroje, které doplňují WorkTrack.',materials:'Materiál',pipeTitle:'PipeStock',pipeCopy:'Evidence instalatérského materiálu, trubek, tvarovek a skladových zůstatků pro zakázky.',open:'Otevřít PipeStock',back:'Na hlavní stránku',hint:'Otevře se uvnitř WorkTrack bez panelů Safari.'},
  en:{title:'Partner programs',copy:'Separate work tools that extend WorkTrack.',materials:'Materials',pipeTitle:'PipeStock',pipeCopy:'Track plumbing materials, pipes, fittings, and stock for job sites.',open:'Open PipeStock',back:'Back to dashboard',hint:'Opens inside WorkTrack without Safari controls.'},
};

export function PartnerProgramsPage(){
  const {language}=useI18n();
  const c=COPY[language]||COPY.uk;
  return <section className="partnerProgramsPage pageStack">
    <header className="partnerProgramsHeader appTop"><BackButton to="/dashboard"/><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>
    <section className="partnerProgramsHero screenCard">
      <span className="partnerProgramsHeroIcon"><SvgIcon name="globe"/></span>
      <div><small>{c.materials}</small><h2>{c.pipeTitle}</h2><p>{c.pipeCopy}</p></div>
      <Link className="partnerProgramsOpen" to="/pipestock?from=worktrack" reloadDocument>{c.open}</Link>
      <p className="partnerProgramsHint">{c.hint}</p>
    </section>
    <Link className="partnerProgramsBack" to="/dashboard">{c.back}</Link>
  </section>;
}
