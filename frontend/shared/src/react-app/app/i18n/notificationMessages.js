export const notificationMessages = {
  uk: {
    notificationDynamic: {
      employeeFallback: 'Працівник',
      submittedTitle: '{name} відправив(ла) тиждень',
      submittedMessage: 'Перевірте робочі години за {period}.',
      submittedFallback: 'Тиждень готовий до перевірки.',
      approvedTitle: 'Тиждень погоджено',
      approvedMessage: 'Ваші години за {period} погоджено.',
      rejectedTitle: 'Потрібні зміни в тижні',
      rejectedFallback: 'Менеджер відхилив цей тиждень. Відкрийте його, внесіть виправлення та відправте повторно.',
    },
  },
  cs: {
    notificationDynamic: {
      employeeFallback: 'Zaměstnanec',
      submittedTitle: '{name} odeslal(a) týden',
      submittedMessage: 'Zkontrolujte pracovní hodiny za období {period}.',
      submittedFallback: 'Týden je připraven ke kontrole.',
      approvedTitle: 'Týden byl schválen',
      approvedMessage: 'Vaše práce za období {period} byla schválena.',
      rejectedTitle: 'Týden vyžaduje úpravy',
      rejectedFallback: 'Manažer tento týden zamítl. Otevřete ho, proveďte opravy a odešlete znovu.',
    },
  },
  en: {
    notificationDynamic: {
      employeeFallback: 'Employee',
      submittedTitle: '{name} submitted a week',
      submittedMessage: 'Review work hours for {period}.',
      submittedFallback: 'A weekly submission is ready for review.',
      approvedTitle: 'Week approved',
      approvedMessage: 'Your work for {period} was approved.',
      rejectedTitle: 'Week needs changes',
      rejectedFallback: 'Your manager rejected this week. Open it to make corrections and resubmit it.',
    },
  },
};

export function getNotificationMessage(language, key) {
  const parts = String(key || '').split('.');
  let current = notificationMessages[language] || notificationMessages.uk;
  for (const part of parts) current = current?.[part];
  return typeof current === 'string' ? current : key;
}
