import { GuestStage } from '../HomePage/components/GuestStage/GuestStage.jsx';

export function SignInPage({ defaultMode = 'login' }) {
  return <GuestStage defaultMode={defaultMode} />;
}
