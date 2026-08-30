import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getApiErrorDetail,
  getApiErrorMessageForLanguage,
} from '../../frontend/shared/src/react-app/app/api/getApiErrorMessage.js';

const PREVIEW_ERRORS = [
  {
    code: 'Complete tax information before creating an invoice',
    uk: 'Заповніть податкові реквізити перед створенням фактури.',
    cs: 'Před vytvořením faktury vyplňte daňové a fakturační údaje.',
    en: 'Complete your tax and billing details before creating an invoice.',
  },
  {
    code: 'Employer billing information is incomplete',
    uk: 'Реквізити компанії для фактур не заповнені. Зверніться до менеджера.',
    cs: 'Fakturační údaje firmy nejsou kompletní. Obraťte se na manažera.',
    en: 'The company billing details are incomplete. Contact your manager.',
  },
  {
    code: 'Hourly rate must be greater than zero before creating an invoice',
    uk: 'Погодинну ставку не встановлено. Зверніться до менеджера.',
    cs: 'Hodinová sazba není nastavena. Obraťte se na manažera.',
    en: 'Your hourly rate has not been set. Contact your manager.',
  },
  {
    code: 'No uninvoiced approved hours for this month',
    uk: 'За вибраний місяць немає погоджених годин, які ще можна додати до фактури.',
    cs: 'Ve vybraném měsíci nejsou schválené hodiny, které lze ještě fakturovat.',
    en: 'There are no approved hours in this month that are still available to invoice.',
  },
];

for (const scenario of PREVIEW_ERRORS) {
  for (const language of ['uk', 'cs', 'en']) {
    test(`invoice preview error is actionable in ${language}: ${scenario.code}`, () => {
      const error = { status: 400, data: { error: scenario.code, details: null } };
      assert.equal(getApiErrorDetail(error), scenario.code);
      assert.equal(getApiErrorMessageForLanguage(error, language), scenario[language]);
    });
  }
}
