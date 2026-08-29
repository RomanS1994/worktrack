import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY = {
  uk: {
    title: 'Налаштування',
    copy: 'Оберіть, що саме хочете налаштувати.',
    company: 'Компанія',
    companyCopy: 'Налаштування роботодавця',
    companyItems: ['Дані компанії', 'Робочий час', 'Реквізити'],
    account: 'Акаунт',
    accountCopy: 'Ваші особисті налаштування',
    accountItems: ['Особисті дані', 'Мова', 'Безпека'],
  },
  cs: {
    title: 'Nastavení',
    copy: 'Vyberte, co chcete nastavit.',
    company: 'Společnost',
    companyCopy: 'Nastavení zaměstnavatele',
    companyItems: ['Údaje společnosti', 'Pracovní doba', 'Fakturační údaje'],
    account: 'Účet',
    accountCopy: 'Vaše osobní nastavení',
    accountItems: ['Osobní údaje', 'Jazyk', 'Zabezpečení'],
  },
  en: {
    title: 'Settings',
    copy: 'Choose what you want to configure.',
    company: 'Company',
    companyCopy: 'Employer settings',
    companyItems: ['Company details', 'Working time', 'Billing details'],
    account: 'Account',
    accountCopy: 'Your personal settings',
    accountItems: ['Personal details', 'Language', 'Security'],
  },
};

function SettingsLink({ to, icon, title, copy, items }) {
  return (
    <Link to={to} className="moreHubSectionLink">
      <span className="moreHubIcon"><SvgIcon name={icon} /></span>
      <span className="moreHubContent">
        <span className="moreHubTitleRow"><strong>{title}</strong><small>{copy}</small></span>
        <span className="moreHubDetails" aria-label={items.join(', ')}>
          {items.map(item => <span key={item}>{item}</span>)}
        </span>
      </span>
      <b aria-hidden="true">›</b>
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
          items={c.companyItems}
        />
        <SettingsLink
          to="/profile"
          icon="profile"
          title={c.account}
          copy={c.accountCopy}
          items={c.accountItems}
        />
      </section>
    </section>
  );
}
