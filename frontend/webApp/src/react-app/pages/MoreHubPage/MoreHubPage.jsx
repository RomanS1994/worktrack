import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY={
 uk:{title:'Налаштування',copy:'Компанія, правила роботи та ваш акаунт.',company:'Компанія',companyCopy:'Назва та системні дані',work:'Робочий час',workCopy:'Обід і денна норма',billing:'Реквізити',billingCopy:'IČO, DIČ, адреса та email',profile:'Профіль',profileCopy:'Особисті дані та безпека',language:'Мова',languageCopy:'Мова інтерфейсу'},
 cs:{title:'Nastavení',copy:'Společnost, pracovní pravidla a váš účet.',company:'Společnost',companyCopy:'Název a systémové údaje',work:'Pracovní doba',workCopy:'Oběd a denní norma',billing:'Fakturační údaje',billingCopy:'IČO, DIČ, adresa a e-mail',profile:'Profil',profileCopy:'Osobní údaje a zabezpečení',language:'Jazyk',languageCopy:'Jazyk rozhraní'},
 en:{title:'Settings',copy:'Company, work rules and your account.',company:'Company',companyCopy:'Name and system details',work:'Working time',workCopy:'Lunch and daily standard',billing:'Billing details',billingCopy:'Company ID, VAT ID, address and email',profile:'Profile',profileCopy:'Personal details and security',language:'Language',languageCopy:'Interface language'}
};

function SettingsLink({to,icon,title,copy}){
 return <Link to={to}><span className="moreHubIcon"><SvgIcon name={icon}/></span><span><strong>{title}</strong><small>{copy}</small></span><b>›</b></Link>;
}

export function MoreHubPage(){
 const {language}=useI18n();const c=COPY[language]||COPY.uk;
 return <section className="moreHub pageStack">
  <header className="moreHubHeader appTop"><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>
  <section className="moreHubMenu screenCard">
   <SettingsLink to="/company-settings?section=identity" icon="building" title={c.company} copy={c.companyCopy}/>
   <SettingsLink to="/company-settings?section=work" icon="clock" title={c.work} copy={c.workCopy}/>
   <SettingsLink to="/company-settings?section=billing" icon="file" title={c.billing} copy={c.billingCopy}/>
  </section>
  <section className="moreHubMenu screenCard">
   <SettingsLink to="/profile" icon="profile" title={c.profile} copy={c.profileCopy}/>
   <SettingsLink to="/profile?section=language" icon="globe" title={c.language} copy={c.languageCopy}/>
  </section>
 </section>;
}
