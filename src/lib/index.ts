// @nomideusz/svelte-i18n — public API

export type {
  Locale,
  Messages,
  MessageLoader,
  I18nConfig,
  I18nInstance,
} from './core/types.js';

export { createI18n } from './core/store.svelte.js';
export { interpolate } from './core/interpolate.js';

// Locale-aware formatting. Pure and store-free, so it works on the server and
// in emails as well as in components.
export { intlLocale, formatDateTime, formatMoney } from './core/format.js';
export { default as LocaleSwitcher } from './components/LocaleSwitcher.svelte';

// URL-locale routing (SSR i18n)
export type { LocaleRoutingConfig } from './core/routing.js';
export {
  extractLocale,
  localizeHref,
  alternates,
  negotiateLocale,
  resolveLocale,
  createReroute,
} from './core/routing.js';
export type { LocaleHandleOptions } from './core/hooks.js';
export { createLocaleHandle } from './core/hooks.js';
