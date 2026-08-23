const pageMessages = {
  uk: {
    fastHours: {
      eyebrow: 'Робочий час', title: 'Мої години', thisWeek: 'Цей тиждень', previous: 'Назад', next: 'Далі', project: 'Проєкт / об’єкт', quick: 'Швидке заповнення', weekday: '8 год Пн–Пт', clear: 'Очистити', hours: 'Години', total: 'Разом', save: 'Зберегти тиждень', saving: 'Збереження…', send: 'Відправити менеджеру', advanced: 'Детальний режим', advancedCopy: 'Кілька об’єктів в один день або редагування окремих записів', saved: 'Тиждень збережено', noProjects: 'Немає активних проєктів', draft: 'Чернетка', submitted: 'Відправлено', approved: 'Погоджено', rejected: 'Повернено', locked: 'Цей тиждень уже відправлено та заблоковано для редагування.'
    },
    hoursTable: {
      eyebrow: 'Звіти', title: 'Таблиця годин', subtitle: 'Місячний огляд робочих годин, статусів і сум.', total: 'Всього годин', approved: 'Погоджено', pending: 'Очікує', approvedAmount: 'Підтверджено', pendingAmount: 'Очікувана сума', date: 'Дата', project: 'Проєкт', hours: 'Години', status: 'Статус', empty: 'У цьому місяці ще немає записів.', loading: 'Завантаження…', draft: 'Чернетка', submitted: 'Відправлено', approvedStatus: 'Погоджено', rejected: 'Повернено'
    },
    tax: {
      eyebrow: 'Налаштування', title: 'Податкова інформація', subtitle: 'Реквізити для автоматичного створення фактур роботодавцю.', seller: 'Ваші реквізити', sellerCopy: 'Ці дані будуть підставлятися у нові фактури.', businessName: 'Ім’я / назва підприємця', ico: 'IČO', dic: 'DIČ / VAT ID', address: 'Адреса', iban: 'IBAN / банківський рахунок', currency: 'Валюта', due: 'Термін оплати', days: 'днів', prefix: 'Префікс фактури', save: 'Зберегти податкові дані', saving: 'Збереження…', saved: 'Податкові дані збережено', loading: 'Завантаження реквізитів…', hoursTable: 'Таблиця годин', hoursTableCopy: 'Перегляньте всі записи за місяць, статуси погодження та суми.', openHoursTable: 'Відкрити таблицю', invoicing: 'Фактури', invoiceCopy: 'Фактура формується з погоджених годин. Після відправлення роботодавець отримає її у своєму кабінеті.', month: 'Період', approved: 'Погоджені години', amount: 'Сума', create: 'Створити фактуру', draft: 'Чернетка', note: 'Наступним кроком підключимо створення PDF, нумерацію та кабінет фактур роботодавця.'
    }
  },
  cs: {
    fastHours: {
      eyebrow: 'Pracovní doba', title: 'Moje hodiny', thisWeek: 'Tento týden', previous: 'Předchozí', next: 'Další', project: 'Projekt / zakázka', quick: 'Rychlé vyplnění', weekday: '8 h Po–Pá', clear: 'Vymazat', hours: 'Hodiny', total: 'Celkem', save: 'Uložit týden', saving: 'Ukládání…', send: 'Odeslat manažerovi', advanced: 'Detailní režim', advancedCopy: 'Více projektů v jednom dni nebo úprava jednotlivých záznamů', saved: 'Týden byl uložen', noProjects: 'Žádné aktivní projekty', draft: 'Koncept', submitted: 'Odesláno', approved: 'Schváleno', rejected: 'Vráceno k úpravě', locked: 'Tento týden již byl odeslán a je uzamčen pro úpravy.'
    },
    hoursTable: {
      eyebrow: 'Přehledy', title: 'Tabulka hodin', subtitle: 'Měsíční přehled pracovních hodin, stavů a částek.', total: 'Celkem hodin', approved: 'Schváleno', pending: 'Čeká', approvedAmount: 'Potvrzená částka', pendingAmount: 'Očekávaná částka', date: 'Datum', project: 'Projekt', hours: 'Hodiny', status: 'Stav', empty: 'V tomto měsíci zatím nejsou žádné záznamy.', loading: 'Načítání…', draft: 'Koncept', submitted: 'Odesláno', approvedStatus: 'Schváleno', rejected: 'Vráceno k úpravě'
    },
    tax: {
      eyebrow: 'Nastavení', title: 'Daňové údaje', subtitle: 'Údaje pro automatické vystavování faktur zaměstnavateli.', seller: 'Vaše fakturační údaje', sellerCopy: 'Tyto údaje se automaticky použijí na nové faktuře.', businessName: 'Jméno / název podnikatele', ico: 'IČO', dic: 'DIČ / VAT ID', address: 'Fakturační adresa', iban: 'IBAN / bankovní účet', currency: 'Měna', due: 'Splatnost', days: 'dnů', prefix: 'Prefix faktury', save: 'Uložit daňové údaje', saving: 'Ukládání…', saved: 'Daňové údaje byly uloženy', loading: 'Načítání údajů…', hoursTable: 'Tabulka hodin', hoursTableCopy: 'Měsíční záznamy, stav schválení a částky na jednom místě.', openHoursTable: 'Otevřít tabulku', invoicing: 'Faktury', invoiceCopy: 'Faktura se vytvoří ze schválených hodin. Po odeslání ji zaměstnavatel uvidí ve svém účtu.', month: 'Období', approved: 'Schválené hodiny', amount: 'Částka', create: 'Vytvořit fakturu', draft: 'Koncept', note: 'Dalším krokem bude generování PDF, číslování faktur a přehled faktur v účtu zaměstnavatele.'
    }
  },
  en: {
    fastHours: {
      eyebrow: 'Work time', title: 'My hours', thisWeek: 'This week', previous: 'Previous', next: 'Next', project: 'Project / site', quick: 'Quick fill', weekday: '8 h Mon–Fri', clear: 'Clear', hours: 'Hours', total: 'Total', save: 'Save week', saving: 'Saving…', send: 'Send to manager', advanced: 'Advanced mode', advancedCopy: 'Multiple projects in one day or individual entry editing', saved: 'Week saved', noProjects: 'No active projects', draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Returned for changes', locked: 'This week has already been submitted and is locked for editing.'
    },
    hoursTable: {
      eyebrow: 'Reports', title: 'Hours table', subtitle: 'Monthly overview of work hours, statuses and amounts.', total: 'Total hours', approved: 'Approved', pending: 'Pending', approvedAmount: 'Confirmed amount', pendingAmount: 'Expected amount', date: 'Date', project: 'Project', hours: 'Hours', status: 'Status', empty: 'There are no entries in this month yet.', loading: 'Loading…', draft: 'Draft', submitted: 'Submitted', approvedStatus: 'Approved', rejected: 'Returned for changes'
    },
    tax: {
      eyebrow: 'Settings', title: 'Tax information', subtitle: 'Details used to automatically invoice your employer.', seller: 'Your billing details', sellerCopy: 'These details will be prefilled on every new invoice.', businessName: 'Name / business name', ico: 'Company ID (IČO)', dic: 'VAT ID (DIČ)', address: 'Billing address', iban: 'IBAN / bank account', currency: 'Currency', due: 'Payment terms', days: 'days', prefix: 'Invoice prefix', save: 'Save tax information', saving: 'Saving…', saved: 'Tax information saved', loading: 'Loading billing details…', hoursTable: 'Hours table', hoursTableCopy: 'Review monthly entries, approval statuses and amounts in one place.', openHoursTable: 'Open hours table', invoicing: 'Invoices', invoiceCopy: 'Invoices are created from approved hours. After sending, your employer receives the invoice in their account.', month: 'Period', approved: 'Approved hours', amount: 'Amount', create: 'Create invoice', draft: 'Draft', note: 'Next we will add PDF generation, invoice numbering, and an employer invoice inbox.'
    }
  }
};

const locales = { uk: 'uk-UA', cs: 'cs-CZ', en: 'en-GB' };

function resolve(object, path) {
  return String(path || '').split('.').reduce((value, part) => value?.[part], object);
}

function flattenKeys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? flattenKeys(value, path) : [path];
  });
}

export function getPageMessage(language, key, values = {}) {
  const dictionary = pageMessages[language] || pageMessages.uk;
  const template = resolve(dictionary, key) ?? resolve(pageMessages.uk, key) ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] == null ? '' : String(values[name]));
}

export function getPageLocale(language) {
  return locales[language] || locales.uk;
}

export function validatePageMessageParity() {
  const baseKeys = flattenKeys(pageMessages.uk).sort();
  return Object.fromEntries(['cs', 'en'].map(language => {
    const keys = flattenKeys(pageMessages[language]).sort();
    return [language, {
      missing: baseKeys.filter(key => !keys.includes(key)),
      extra: keys.filter(key => !baseKeys.includes(key)),
    }];
  }));
}

if (import.meta.env?.DEV) {
  const parity = validatePageMessageParity();
  const invalid = Object.entries(parity).filter(([, result]) => result.missing.length || result.extra.length);
  if (invalid.length) console.warn('[i18n] WorkTrack page translations are out of sync', parity);
}
