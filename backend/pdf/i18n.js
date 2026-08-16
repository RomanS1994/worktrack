export const SUPPORTED_PDF_LANGUAGES = ['cs'];
export const DEFAULT_PDF_LANGUAGE = 'cs';

const PDF_MESSAGES = {
  cs: {
    document: {
      offerHeading: 'Nabídka přepravy osob',
      confirmationHeading: 'Smlouva o přepravě osob',
      offerTitle: 'Přepravní nabídka',
      confirmationTitle: 'Přepravní smlouva',
    },
    paymentMethod: 'hotovost / kartou na místě',
    subtitle: {
      carrier: 'Přepravce / Řidič:',
      provider: 'Zprostředkovatel (Poskytovatel služby):',
      customer: 'Objednatel / Cestující:',
      trip: 'Údaje o přepravě:',
    },
    labels: {
      name: 'Jméno:',
      companyName: 'Jméno / Název firmy:',
      address: 'Adresa:',
      vehiclePlate: 'SPZ vozidla:',
      ico: 'IČ:',
      dic: 'DIČ:',
      emailPhone: 'E-mail, telefon:',
      birthDate: 'Datum narození:',
      residentialAddress: 'Adresa bydliště:',
      passengers: 'Počet klientů:',
      pickup: 'Místo nástupu:',
      dropoff: 'Místo ukončení:',
      datetime: 'Datum a čas:',
      price: 'Cena:',
      payment: 'Způsob platby:',
    },
    notice: 'Smlouva uzavřena dle § 21 odst. 5 zákona č. 111/1994 Sb., o silniční dopravě',
    header: {
      issued: 'Datum vystavení:',
    },
    issuedIn: 'V Praze dne',
    carrierSignature: 'Podpis přepravce:',
    customerSignature: 'Podpis objednatele:',
  },
};

export function normalizePdfLanguage(value) {
  return SUPPORTED_PDF_LANGUAGES.includes(String(value || '').toLowerCase())
    ? 'cs'
    : DEFAULT_PDF_LANGUAGE;
}

export function getPdfMessage(language, key) {
  const parts = String(key || '').split('.');
  let current = PDF_MESSAGES[normalizePdfLanguage(language)] || PDF_MESSAGES[DEFAULT_PDF_LANGUAGE];

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return key;
    }

    current = current[part];
  }

  return typeof current === 'string' ? current : key;
}
