import { useSelector } from 'react-redux';

import { selectUser } from '@shared/features/auth/authSlice.js';
import { DashboardPage } from '../DashboardPage/DashboardPage.jsx';
import { GuestStage } from './components/GuestStage/GuestStage.jsx';

export function HomePage() {
  const user = useSelector(selectUser);

  if (!user) {
    return <GuestStage defaultMode="login" />;
  }

  return <DashboardPage />;
}
