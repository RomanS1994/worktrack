import { useSelector } from 'react-redux';

import { useI18n } from '../../i18n/useI18n.js';
import { hasManagerAccess } from '../../../features/auth/authAccess.js';
import { selectUser } from '../../../features/auth/authSlice.js';
import { useCabinetMode } from '../../../features/auth/cabinetMode.js';
import './CabinetModeBadge.css';

const COPY = {
  uk: { manager: 'Менеджер', employee: 'Працівник' },
  cs: { manager: 'Manažer', employee: 'Pracovník' },
  en: { manager: 'Manager', employee: 'Employee' },
};

export function CabinetModeBadge() {
  const user = useSelector(selectUser);
  const { language } = useI18n();
  const mode = useCabinetMode(user);
  if (!hasManagerAccess(user)) return null;
  const copy = COPY[language] || COPY.uk;

  return (
    <div className={`cabinetModeBadge is-${mode}`} aria-label={copy[mode]} title={copy[mode]}>
      <span aria-hidden="true" />
      <strong>{copy[mode]}</strong>
    </div>
  );
}
