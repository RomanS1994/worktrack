import { router } from '../../router.jsx';
import { store } from '../../store.js';
import { AppProviders as SharedAppProviders } from '@shared/app/providers/AppProviders.jsx';

export function AppProviders() {
  return <SharedAppProviders router={router} store={store} />;
}
