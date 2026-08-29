import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY = {
  uk: {
    title: 'Налаштування',
    copy: 'Керуйте компанією та своїм акаунтом.',
    company: 'Компанія',
    companyCopy: 'Назва, робочий час і реквізити',
    profile: 'Профіль',
    profileCopy: 'Особисті дані, мова та безпека',
  },
  cs: {
    title: 'Nastavení',
    copy: 'Spravujte společnost a svůj účet.',
    company: 'Společnost',
    companyCopy: 'Název, pracovní doba a fakturační údaje',
    profile: 'Profil',
    profileCopy: 'Osobní údaje, jazyk a zabezpečení',
  },
  en: {
    title: 'Settings',
    copy: 'Manage your company and account.',
    company: 'Company',
    companyCopy: 'Name, working time and billing details',
    profile: 'Profile',
    profileCopy: 'Personal details, language and security',
  },
};

function SettingsLink({ to, icon, title, copy }) {
  return (
    <Link to={to}>
      <span className="moreHubIcon"><SvgIcon name={icon} /></span>
      <span><strong>{title}</strong><small>{copy}</small></span>
      <b>›</b>
    </Link>
  );
}

export function MoreHubPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;

  return (
    <section className="moreHub pageStack">
      <header className="moreHubHeader appTop">
        <div className="appTitleBlock">
          <h1>{c.title}</h1>
          <p>{c.copy}</p>
        </div>
      </header>

      <section className="moreHubMenu screenCard">
        <SettingsLink
          to="/company-settings"
          icon="location"
          title={c.company}
          copy={c.companyCopy}
        />
        <SettingsLink
          to="/profile"
          icon="profile"
          title={c.profile}
          copy={c.profileCopy}
        />
      </section>
    </section>
  );
}
