import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  hasActiveCompanyAccess,
  hasEmployeeAccess,
  hasManagerAccess,
} from '../../../features/auth/authAccess.js';
import {
  selectSessionInitialized,
  selectToken,
  selectUser,
} from '../../../features/auth/authSlice.js';
import './ProtectedRoute.css';

export function ProtectedRoute({
  children,
  requireEmployee = false,
  requireManager = false,
}) {
  const initialized = useSelector(selectSessionInitialized);
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
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

  if (requireManager && !hasManagerAccess(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireEmployee && !hasEmployeeAccess(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
