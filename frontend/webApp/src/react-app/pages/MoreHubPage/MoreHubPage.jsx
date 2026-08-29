import { Link } from 'react-router-dom';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import './MoreHubPage.css';

const COPY = {
  uk: {
    title: 'Налаштування',
    copy: 'Змінюйте параметри компанії та свого акаунта.',
    companyGroup: 'Компанія',
    identity: 'Дані компанії',
    identityCopy: 'Назва компанії та системні дані',
    billing: 'Реквізити',
    billingCopy: 'IČO, DIČ, адреса та email для фактур',
    workGroup: 'Робочі правила',
    work: 'Робочий час',
    workCopy: 'Обід і денна норма годин',
    accountGroup: 'Особисті налаштування',
    personal: 'Особисті дані',
    personalCopy: 'Імʼя, телефон і фото',
    language: 'Мова',
    languageCopy: 'Мова інтерфейсу',
    securityGroup: 'Безпека й акаунт',
    security: 'Змінити пароль',
    securityCopy: 'Оновити пароль входу',
    accountManagement: 'Керування акаунтом',
    accountManagementCopy: 'Вийти або видалити акаунт',
  },
  cs: {
    title: 'Nastavení',
    copy: 'Měňte nastavení společnosti a svého účtu.',
    companyGroup: 'Společnost',
    identity: 'Údaje společnosti',
    identityCopy: 'Název společnosti a systémové údaje',
    billing: 'Fakturační údaje',
    billingCopy: 'IČO, DIČ, adresa a e-mail pro faktury',
    workGroup: 'Pracovní pravidla',
    work: 'Pracovní doba',
    workCopy: 'Přestávka a denní norma hodin',
    accountGroup: 'Osobní nastavení',
    personal: 'Osobní údaje',
    personalCopy: 'Jméno, telefon a fotografie',
    language: 'Jazyk',
    languageCopy: 'Jazyk rozhraní',
    securityGroup: 'Zabezpečení a účet',
    security: 'Změnit heslo',
    securityCopy: 'Aktualizovat přihlašovací heslo',
    accountManagement: 'Správa účtu',
    accountManagementCopy: 'Odhlášení nebo odstranění účtu',
  },
  en: {
    title: 'Settings',
    copy: 'Change company and account settings.',
    companyGroup: 'Company',
    identity: 'Company details',
    identityCopy: 'Company name and system details',
    billing: 'Billing details',
    billingCopy: 'Company ID, VAT ID, address and invoice email',
    workGroup: 'Work rules',
    work: 'Working time',
    workCopy: 'Lunch deduction and daily hour standard',
    accountGroup: 'Personal settings',
    personal: 'Personal details',
    personalCopy: 'Name, phone and photo',
    language: 'Language',
    languageCopy: 'Interface language',
    securityGroup: 'Security and account',
    security: 'Change password',
    securityCopy: 'Update your sign-in password',
    accountManagement: 'Account management',
    accountManagementCopy: 'Sign out or delete account',
  },
};

function SettingsRow({ to, icon, title, copy, tone = 'default' }) {
  return (
    <Link to={to} className={`moreHubRow moreHubRow--${tone}`}>
      <span className="moreHubIcon"><SvgIcon name={icon} /></span>
      <span className="moreHubRowText"><strong>{title}</strong><small>{copy}</small></span>
      <span className="moreHubChevron" aria-hidden="true">›</span>
    </Link>
  );
}

function SettingsGroup({ title, children }) {
  return <section className="moreHubGroup"><h2>{title}</h2><div className="moreHubMenu screenCard">{children}</div></section>;
}

export function MoreHubPage() {
  const { language } = useI18n();
  const c = COPY[language] || COPY.uk;

  return (
    <section className="moreHub pageStack">
      <header className="moreHubHeader appTop"><div className="appTitleBlock"><h1>{c.title}</h1><p>{c.copy}</p></div></header>

      <SettingsGroup title={c.companyGroup}>
        <SettingsRow to="/company-settings?section=identity&from=settings" icon="location" tone="company" title={c.identity} copy={c.identityCopy} />
        <SettingsRow to="/company-settings?section=billing&from=settings" icon="file" tone="billing" title={c.billing} copy={c.billingCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.workGroup}>
        <SettingsRow to="/company-settings?section=work&from=settings" icon="clock" tone="work" title={c.work} copy={c.workCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.accountGroup}>
        <SettingsRow to="/profile?section=personal&from=settings" icon="user" tone="personal" title={c.personal} copy={c.personalCopy} />
        <SettingsRow to="/profile?section=language&from=settings" icon="monitor" tone="language" title={c.language} copy={c.languageCopy} />
      </SettingsGroup>

      <SettingsGroup title={c.securityGroup}>
        <SettingsRow to="/profile?section=password&from=settings" icon="settings" tone="security" title={c.security} copy={c.securityCopy} />
        <SettingsRow to="/profile?section=account&from=settings" icon="user" tone="danger" title={c.accountManagement} copy={c.accountManagementCopy} />
      </SettingsGroup>
    </section>
  );
}
