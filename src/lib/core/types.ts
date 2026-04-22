// packages/svelte-i18n/src/lib/core/types.ts

/** A locale identifier, e.g. 'en', 'pl', 'de' */
export type Locale = string;

/** Flat key → translated string map (e.g. { "nav.home": "Home" }) */
export type Messages = Record<string, string>;

/**
 * Function that loads messages for a given locale.
 * Can return synchronously (inline object) or asynchronously (dynamic import).
 */
export type MessageLoader = (locale: Locale) => Promise<Messages> | Messages;

/** Configuration for createI18n. */
export interface I18nConfig {
  /** The locale to use on init. */
  defaultLocale: Locale;
  /** All locales the app supports. */
  supportedLocales: Locale[];
  /** Function that returns messages for a locale. Called lazily, result is cached. */
  loader: MessageLoader;
}

/** The public API returned by createI18n(). */
export interface I18nInstance {
  /** Current locale (reactive via $state). */
  readonly locale: Locale;
  /**
   * True while an async loader is fetching messages for a locale.
   * Synchronous loaders never flip this to true — messages are applied immediately.
   */
  readonly isLoading: boolean;
  /** Translate a key, with optional {variable} interpolation. Returns the key itself if missing. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Switch to a different locale. Returns a promise that resolves when messages are loaded. */
  setLocale: (locale: Locale) => Promise<void>;
  /** All supported locales from config. */
  readonly supportedLocales: Locale[];
}
