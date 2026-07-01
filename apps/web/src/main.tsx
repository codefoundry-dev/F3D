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

// A new deploy replaces the previous build's content-hashed chunks. A tab left
// open across a deploy still references the old chunk URLs, so navigating to a
// lazy route 404s the now-missing chunk — and because our SPA rewrite serves
// index.html for any unmatched path, the browser gets HTML for a module request
// ("Failed to load module script … MIME type text/html"), the dynamic import
// rejects, and React Router shows the error screen. Vite's preload helper fires
// `vite:preloadError` for exactly this; reload once to pull the current
// index.html + chunk graph. The timestamp guard stops a reload loop if the
// asset is genuinely broken on the live build.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'vite-preload-reload-at';
  const last = Number(sessionStorage.getItem(KEY) ?? 0);
  if (Date.now() - last < 10_000) return; // already reloaded moments ago — don't loop
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

const apiClient = initApiClient(
  (import.meta.env.VITE_API_URL as string | undefined) ?? '/v1',
  'web',
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
