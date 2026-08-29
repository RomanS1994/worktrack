import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY = {
  uk: {
    title: 'Налаштування',
    copy: 'Усі параметри компанії та акаунта в одному місці.',
    companyGroup: 'Компанія',
    identity: 'Дані компанії',
    identityCopy: 'Назва та системні дані',
    billing: 'Реквізити',
    billingCopy: 'IČO, DIČ, адреса та email',
    workGroup: 'Робота',
    work: 'Робочий час',
    workCopy: 'Обід і денна норма',
    accountGroup: 'Акаунт',
    personal: 'Особисті дані',
    personalCopy: 'Імʼя, телефон і фото',
    workInfo: 'Робочі дані',
    workInfoCopy: 'Роль, компанія та ставка',
    language: 'Мова',
    languageCopy: 'Мова інтерфейсу',
    securityGroup: 'Безпека',
    security: 'Пароль',
    securityCopy: 'Зміна пароля та захист акаунта',
  },
  cs: {
    title: 'Nastavení',
    copy: 'Všechna nastavení společnosti a účtu na jednom místě.',
    companyGroup: 'Společnost',
    identity: 'Údaje společnosti',
    identityCopy: 'Název a systémové údaje',
    billing: 'Fakturační údaje',
    billingCopy: 'IČO, DIČ, adresa a e-mail',
    workGroup: 'Práce',
    work: 'Pracovní doba',
    workCopy: 'Přestávka a denní norma',
    accountGroup: 'Účet',
    personal: 'Osobní údaje',
    personalCopy: 'Jméno, telefon a fotografie',
    workInfo: 'Pracovní údaje',
    workInfoCopy: 'Role, společnost a sazba',
    language: 'Jazyk',
    languageCopy: 'Jazyk rozhraní',
    securityGroup: 'Zabezpečení',
    security: 'Heslo',
    securityCopy: 'Změna hesla a zabezpečení účtu',
  },
  en: {
    title: 'Settings',
    copy: 'All company and account settings in one place.',
    companyGroup: 'Company',
    identity: 'Company details',
    identityCopy: 'Name and system details',
    billing: 'Billing details',
    billingCopy: 'Company ID, VAT ID, address and email',
    workGroup: 'Work',
    work: 'Working time',
    workCopy: 'Lunch deduction and daily standard',
    accountGroup: 'Account',
    personal: 'Personal details',
    personalCopy: 'Name, phone and photo',
    workInfo: 'Work details',
    workInfoCopy: 'Role, company and rate',
    language: 'Language',
    languageCopy: 'Interface language',
    securityGroup: 'Security',
    security: 'Password',
    securityCopy: 'Change password and protect account',
  },
};

function SettingsRow({ to, icon, title, copy }) {
  return (
    <Link to={to} className="moreHubRow">
      <span className="moreHubIcon"><SvgIcon name={icon} /></span>
      <span className="moreHubRowText">
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <b aria-hidden="true">›</b>
    </Link>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <section className="moreHubGroup">
      <h2>{title}</h2>
      <div className="moreHubMenu screenCard">{children}</div>
    </section>
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

      <SettingsGroup title={c.companyGroup}>
        <SettingsRow to="/company-settings?section=identity" icon="location" title={c.identity} copy={c.identityCopy} />
        <SettingsRow to="/company-settings?section=billing" icon="file" title={c.billing} copy={c.billingCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.workGroup}>
        <SettingsRow to="/company-settings?section=work" icon="clock" title={c.work} copy={c.workCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.accountGroup}>
        <SettingsRow to="/profile?section=personal" icon="profile" title={c.personal} copy={c.personalCopy} />
        <SettingsRow to="/profile?section=work" icon="briefcase" title={c.workInfo} copy={c.workInfoCopy} />
        <SettingsRow to="/profile?section=language" icon="monitor" title={c.language} copy={c.languageCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.securityGroup}>
        <SettingsRow to="/profile?section=password" icon="lock" title={c.security} copy={c.securityCopy} />
      </SettingsGroup>
    </section>
  );
}
