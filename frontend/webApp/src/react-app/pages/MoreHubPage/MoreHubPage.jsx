import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY={
 uk:{eyebrow:'Ще',title:'Ще',copy:'Налаштування компанії та вашого акаунта.',company:'Компанія',companyCopy:'Назва, робочий час і реквізити',profile:'Профіль',profileCopy:'Особисті дані, мова та безпека'},
 cs:{eyebrow:'Více',title:'Více',copy:'Nastavení společnosti a vašeho účtu.',company:'Společnost',companyCopy:'Název, pracovní doba a fakturační údaje',profile:'Profil',profileCopy:'Osobní údaje, jazyk a zabezpečení'},
 en:{eyebrow:'More',title:'More',copy:'Company and account settings.',company:'Company',companyCopy:'Name, working time and billing details',profile:'Profile',profileCopy:'Personal details, language and security'}
};
export function MoreHubPage(){
 const {language}=useI18n();const c=COPY[language]||COPY.uk;
 return <section className="moreHub pageStack">
  <header className="moreHubHeader appTop"><div className="appTitleBlock"><p className="sectionEyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.copy}</p></div></header>
  <section className="moreHubMenu screenCard">
   <Link to="/company-settings"><span><SvgIcon name="location"/></span><span><strong>{c.company}</strong><small>{c.companyCopy}</small></span><b>›</b></Link>
   <Link to="/profile"><span><SvgIcon name="profile"/></span><span><strong>{c.profile}</strong><small>{c.profileCopy}</small></span><b>›</b></Link>
  </section>
 </section>;
}
