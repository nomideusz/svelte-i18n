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
export { default as LocaleSwitcher } from './components/LocaleSwitcher.svelte';
