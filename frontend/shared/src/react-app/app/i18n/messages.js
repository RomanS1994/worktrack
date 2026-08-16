export const messages = {
  uk: {
    common: {
      failed: 'Не вдалося завантажити.',
      backToHome: 'Повернутися на головну',
    },
    app: {
      dashboard: 'Дашборд',
      hours: 'Години',
      employees: 'Працівники',
      approvals: 'Погодження',
      profile: 'Профіль',
    },
    auth: {
      email: 'E-mail',
      password: 'Пароль',
      login: 'Увійти',
      loginTitle: 'Вхід',
      loginFailed: 'Не вдалося увійти. Перевірте email і пароль.',
      loggingIn: 'Вхід...',
      showPassword: 'Показати пароль',
      hidePassword: 'Приховати пароль',
      sessionState: 'Сесія',
      sessionExpired: 'Сесію завершено',
      sessionExpiredSignIn: 'Увійдіть ще раз, щоб продовжити роботу.',
      connectionLostKeepSession: 'З’єднання втрачено. Сесію збережено, спробуйте ще раз.',
      sessionCheckFailedKeepSession: 'Не вдалося перевірити сесію. Спробуйте ще раз.',
      goToSignIn: 'Перейти до входу',
    },
    bottomTabs: {
      navLabel: 'Основна навігація',
    },
    guest: {
      titleLogin: 'Облік робочого часу',
      textLogin: 'Години, погодження та оплата в одному робочому просторі.',
      signInHeading: 'Увійдіть, щоб продовжити',
      signInCopy: 'Використовуйте email і пароль, щоб повернутися до свого простору.',
    },
    settings: {
      languageCard: {
        label: 'Мова інтерфейсу',
        uk: 'Українська',
        en: 'Англійська',
        cs: 'Чеська',
      },
    },
  },
  en: {
    common: {
      failed: 'Failed to load.',
      backToHome: 'Back to home',
    },
    app: {
      dashboard: 'Dashboard',
      hours: 'Hours',
      employees: 'Employees',
      approvals: 'Approvals',
      profile: 'Profile',
    },
    auth: {
      email: 'Email',
      password: 'Password',
      login: 'Sign in',
      loginTitle: 'Sign in',
      loginFailed: 'Sign-in failed. Check your email and password.',
      loggingIn: 'Signing in...',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      sessionState: 'Session',
      sessionExpired: 'Session expired',
      sessionExpiredSignIn: 'Sign in again to continue working.',
      connectionLostKeepSession: 'Connection was lost. Your session is kept, try again.',
      sessionCheckFailedKeepSession: 'Session check failed. Try again.',
      goToSignIn: 'Go to sign in',
    },
    bottomTabs: {
      navLabel: 'Primary navigation',
    },
    guest: {
      titleLogin: 'Work hours tracking',
      textLogin: 'Hours, approvals, and payroll in one workspace.',
      signInHeading: 'Sign in to continue',
      signInCopy: 'Use your email and password to return to your workspace.',
    },
    settings: {
      languageCard: {
        label: 'Interface language',
        uk: 'Ukrainian',
        en: 'English',
        cs: 'Czech',
      },
    },
  },
  cs: {
    common: {
      failed: 'Nepodařilo se načíst.',
      backToHome: 'Zpět domů',
    },
    app: {
      dashboard: 'Přehled',
      hours: 'Hodiny',
      employees: 'Zaměstnanci',
      approvals: 'Schvalování',
      profile: 'Profil',
    },
    auth: {
      email: 'E-mail',
      password: 'Heslo',
      login: 'Přihlásit se',
      loginTitle: 'Přihlášení',
      loginFailed: 'Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo.',
      loggingIn: 'Přihlašování...',
      showPassword: 'Zobrazit heslo',
      hidePassword: 'Skrýt heslo',
      sessionState: 'Relace',
      sessionExpired: 'Relace vypršela',
      sessionExpiredSignIn: 'Pro pokračování se přihlaste znovu.',
      connectionLostKeepSession: 'Spojení bylo ztraceno. Relace zůstává uložená, zkuste to znovu.',
      sessionCheckFailedKeepSession: 'Kontrola relace se nezdařila. Zkuste to znovu.',
      goToSignIn: 'Přejít k přihlášení',
    },
    bottomTabs: {
      navLabel: 'Hlavní navigace',
    },
    guest: {
      titleLogin: 'Evidence pracovní doby',
      textLogin: 'Hodiny, schvalování a mzdy v jednom pracovním prostoru.',
      signInHeading: 'Přihlaste se a pokračujte',
      signInCopy: 'Použijte e-mail a heslo pro návrat do svého prostoru.',
    },
    settings: {
      languageCard: {
        label: 'Jazyk rozhraní',
        uk: 'Ukrajinština',
        en: 'Angličtina',
        cs: 'Čeština',
      },
    },
  },
};

export function getMessage(language, key) {
  const parts = String(key || '').split('.');
  let current = messages[language] || messages.uk;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return key;
    }

    current = current[part];
  }

  return typeof current === 'string' ? current : key;
}
