import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { hideStartupSplash } from '@shared/app/startupSplash.js';

import { AppProviders } from './app/providers/AppProviders.jsx';

const rootElement = document.getElementById('react-root');

function StartupSplashController() {
  useEffect(() => {
    hideStartupSplash();
  }, []);

  return null;
}

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <AppProviders />
      <StartupSplashController />
    </React.StrictMode>,
  );
}
