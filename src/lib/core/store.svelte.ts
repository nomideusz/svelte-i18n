// packages/svelte-i18n/src/lib/core/store.svelte.ts

import type { Locale, Messages, I18nConfig, I18nInstance } from './types.js';
import { interpolate } from './interpolate.js';

/**
 * Create an i18n instance with Svelte 5 runes-based reactivity.
 *
 * @example
 * // src/lib/i18n.ts
 * import { createI18n } from '@nomideusz/svelte-i18n';
 *
 * export const i18n = createI18n({
 *   defaultLocale: 'en',
 *   supportedLocales: ['en', 'pl'],
 *   loader: (locale) => import(`./messages/${locale}.json`),
 * });
 */
export function createI18n(config: I18nConfig): I18nInstance {
  let _locale = $state(config.defaultLocale);
  let _isLoading = $state(false);
  let _messages = $state<Messages>({});

  // Cache: locale → messages (never re-fetches the same locale)
  const cache = new Map<Locale, Messages>();
  // In-flight loads, so two callers racing for the same locale share one fetch.
  const pending = new Map<Locale, Promise<void>>();

  /**
   * Extract messages from a loader result, handling `{ default: {...} }` from
   * dynamic imports. The test is the SHAPE, not truthiness: a `Messages` value
   * is always a string, so a catalog with a key literally named "default"
   * (an ordinary word) is a catalog, not a module namespace.
   */
  function unwrap(loaded: Messages | Record<string, unknown>): Messages {
    const maybeDefault = (loaded as Record<string, unknown>).default;
    return (maybeDefault && typeof maybeDefault === 'object' ? maybeDefault : loaded) as Messages;
  }

  function applyMessages(locale: Locale, msgs: Messages): void {
    cache.set(locale, msgs);
    // A load that finished after the locale moved on stays cached but is never
    // published — otherwise a slow catalog overwrites the one now on screen.
    if (locale !== _locale) return;
    _messages = msgs;
    _isLoading = false;
  }

  function loadMessages(locale: Locale): Promise<void> | void {
    const cached = cache.get(locale);
    if (cached) {
      _messages = cached;
      _isLoading = false;
      return;
    }

    const inFlight = pending.get(locale);
    if (inFlight) return inFlight;

    const result = config.loader(locale);
    // Synchronous loader — apply immediately so SSR's first render has messages.
    if (!(result instanceof Promise)) {
      applyMessages(locale, unwrap(result));
      return;
    }

    _isLoading = true;
    const load = result
      .then((loaded) => applyMessages(locale, unwrap(loaded)))
      .catch((err) => {
        _isLoading = false;
        throw err;
      })
      .finally(() => pending.delete(locale));
    pending.set(locale, load);
    return load;
  }

  // Eagerly load the default locale. The promise is deliberately handled here:
  // this runs at module scope in every consumer, and an unhandled rejection
  // there takes the whole SSR process down under Node's default policy.
  const initial = loadMessages(config.defaultLocale);
  if (initial) {
    initial.catch((err) => {
      console.error(`[svelte-i18n] failed to load default locale "${config.defaultLocale}"`, err);
    });
  }

  // One PluralRules per locale — construction is the expensive part.
  const pluralRules = new Map<Locale, Intl.PluralRules>();
  function pluralCategory(locale: Locale, n: number): Intl.LDMLPluralRule {
    let rules = pluralRules.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale);
      pluralRules.set(locale, rules);
    }
    return rules.select(n);
  }

  /** Own keys only — `t('constructor')` must miss, not return Object's. */
  function lookup(key: string): string | undefined {
    return Object.hasOwn(_messages, key) ? _messages[key] : undefined;
  }

  return {
    get locale() {
      return _locale;
    },

    get isLoading() {
      return _isLoading;
    },

    get supportedLocales() {
      return config.supportedLocales;
    },

    t(key: string, params?: Record<string, string | number>): string {
      let value = lookup(key);
      // Plural selection: no exact key + a numeric `count` → CLDR-suffixed
      // variants (`key_one` / `key_few` / `key_many` / `key_other`), chosen by
      // Intl.PluralRules for the active locale. This is the convention app
      // catalogs already used by hand; `_other` is the required fallback
      // category, same as CLDR. An exact key always wins, so nothing existing
      // changes meaning.
      if (value === undefined && typeof params?.count === 'number') {
        value = lookup(`${key}_${pluralCategory(_locale, params.count)}`) ?? lookup(`${key}_other`);
      }
      if (value === undefined) return key;
      return interpolate(value, params);
    },

    async setLocale(locale: Locale): Promise<void> {
      if (!config.supportedLocales.includes(locale)) {
        console.warn(`[svelte-i18n] Locale "${locale}" is not in supportedLocales.`);
        return;
      }
      if (locale === _locale && (cache.has(locale) || pending.has(locale))) return;
      const previous = _locale;
      _locale = locale;
      try {
        const result = loadMessages(locale);
        if (result) await result;
      } catch (err) {
        // The switch failed, so it did not happen: a UI reading `locale` must
        // not claim a language whose messages never arrived.
        _locale = previous;
        const restored = cache.get(previous);
        if (restored) _messages = restored;
        throw err;
      }
    },
  };
}
