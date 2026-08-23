import { validateTranslationParity } from '../frontend/shared/src/react-app/app/i18n/messageResolver.js';

const parity = validateTranslationParity();
const problems = Object.entries(parity).filter(([, result]) => result.missing.length || result.extra.length);

if (problems.length) {
  console.error('i18n dictionaries are out of sync.');
  for (const [language, result] of problems) {
    if (result.missing.length) console.error(`${language}: missing -> ${result.missing.join(', ')}`);
    if (result.extra.length) console.error(`${language}: extra -> ${result.extra.join(', ')}`);
  }
  process.exit(1);
}

console.log('i18n parity OK: uk, cs and en contain the same translation keys.');
