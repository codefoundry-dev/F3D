import {
  initApiClient,
  applyAuthInterceptor,
  configureAuthInterceptor,
  applyErrorInterceptor,
} from '@forethread/api-client';
import { ThemeProvider, Toaster, notificationService } from '@forethread/ui-components';
import React from 'react';
import { createRoot } from 'react-dom/client';

import '@forethread/i18n';
import { App } from './app/App';
import { useAuthStore } from './features/auth/state/auth.store';
import './styles/globals.css';

// Initialize API client with base URL from env and apply interceptors
const apiClient = initApiClient(
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/v1',
  'procurement-officer',
);
applyAuthInterceptor(apiClient);
configureAuthInterceptor(apiClient, () => {
  if (useAuthStore.getState().isAuthenticated) {
    useAuthStore.getState().clearAuth();
  }
});
applyErrorInterceptor(apiClient, (msg) => notificationService.error(msg));

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing root element');

createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <App />
      <Toaster position="bottom-right" duration={5000} />
    </ThemeProvider>
  </React.StrictMode>,
);
