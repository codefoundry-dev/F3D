/**
 * @forethread/i18n — Shared internationalisation package.
 *
 * Constitution Reference: Principle X — Internationalisation (i18n)
 *
 * Usage in any app:
 *   import '@forethread/i18n';          // initializes i18next
 *   import { useTranslation } from '@forethread/i18n';
 *   const { t } = useTranslation('auth');
 *   <span>{t('signIn')}</span>
 */

// Initialize i18next (side-effect import)
import './config';

// Re-export type augmentation so consumers get typed `t()` automatically
import './types';

// Re-export commonly used hooks and components from react-i18next
export { useTranslation, Trans, I18nextProvider } from 'react-i18next';

// Re-export the configured instance for advanced use
export { default as i18n } from './config';
export type { AppResources, AppNamespace } from './types';
