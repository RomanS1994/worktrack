import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { hasActiveCompanyAccess } from '@shared/features/auth/authAccess.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import { DashboardPage } from '../DashboardPage/DashboardPage.jsx';
import { GuestStage } from './components/GuestStage/GuestStage.jsx';

export function HomePage() {
  const user = useSelector(selectUser);

  if (!user) {
    return <GuestStage defaultMode="login" />;
  }

  if (!hasActiveCompanyAccess(user)) {
    return <Navigate to="/profile" replace />;
  }

  return <DashboardPage />;
}
