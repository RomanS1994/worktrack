import { Link, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  hasActiveCompanyAccess,
  hasEmployeeAccess,
  hasManagerAccess,
} from '../../../features/auth/authAccess.js';
import { useCabinetMode } from '../../../features/auth/cabinetMode.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  selectSessionInitialized,
  selectToken,
  selectUser,
} from '../../../features/auth/authSlice.js';
import './ProtectedRoute.css';

const ACCESS_BLOCKED_COPY = {
  uk: { title: 'Доступ до кабінету працівника вимкнено', text: 'Зверніться до менеджера компанії, щоб відновити доступ.', profile: 'Відкрити профіль' },
  cs: { title: 'Přístup do zaměstnaneckého kabinetu je vypnutý', text: 'Požádejte manažera společnosti o obnovení přístupu.', profile: 'Otevřít profil' },
  en: { title: 'Employee cabinet access is disabled', text: 'Contact your company manager to restore access.', profile: 'Open profile' },
};

function EmployeeCabinetAccessBlocked() {
  const { language } = useI18n();
  const copy = ACCESS_BLOCKED_COPY[language] || ACCESS_BLOCKED_COPY.uk;
  return (
    <section className="protectedRoute" role="status">
      <h1>{copy.title}</h1>
      <p className="protectedRoute-message">{copy.text}</p>
      <Link className="protectedRoute-link" to="/profile">{copy.profile}</Link>
    </section>
  );
}

export function ProtectedRoute({
  children,
  requireEmployee = false,
  requireEmployeeCabinet = false,
  requireManager = false,
}) {
  const initialized = useSelector(selectSessionInitialized);
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const cabinetMode = useCabinetMode(user);
  const location = useLocation();

  if (!initialized) {
    return null;
  }

  if (!token || !user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  if (!hasActiveCompanyAccess(user) && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  if (requireManager && (!hasManagerAccess(user) || cabinetMode !== 'manager')) {
    return <Navigate to="/dashboard" replace />;
  }

  const managerCabinet = hasManagerAccess(user) && cabinetMode === 'manager';
  if (requireEmployeeCabinet && !managerCabinet && !hasEmployeeAccess(user)) {
    return <EmployeeCabinetAccessBlocked />;
  }

  if (requireEmployee && !hasEmployeeAccess(user)) {
    return <EmployeeCabinetAccessBlocked />;
  }

  if (requireEmployee && cabinetMode !== 'employee') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
