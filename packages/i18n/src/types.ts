import type { resources } from './config';

/** Typed namespace keys derived from the English resource bundle. */
export type AppResources = (typeof resources)['en'];

/** All available translation namespaces. */
export type AppNamespace = keyof AppResources;

/**
 * Augment react-i18next so `useTranslation()` and `t()` are fully typed.
 *
 * Consuming apps do NOT need to re-declare this — importing `@forethread/i18n`
 * is sufficient for the type augmentation to take effect.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: AppResources;
  }
}
