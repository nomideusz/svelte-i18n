// packages/svelte-i18n/src/lib/core/routing.ts
//
// URL-locale routing helpers for SSR i18n. All pure functions — no Svelte,
// no runtime state — so they run identically in hooks, load functions, and
// the browser, and are trivially unit-testable.
//
// Strategy: PATH PREFIX with a bare default locale.
//   defaultLocale 'pl'  →  /krakow            (no prefix)
//   other locales       →  /en/krakow, /uk/krakow
//
// The default locale is intentionally never a valid prefix, so /pl/krakow is
// treated as an ordinary path (a city literally named "pl") rather than a
// duplicate of /krakow. The app can 301 any stray /pl/* → /* if desired.

import type { Locale } from './types.js';

export interface LocaleRoutingConfig {
  /** Locale served at the un-prefixed root (e.g. 'pl' → `/krakow`). */
  defaultLocale: Locale;
  /** Every locale the app serves, including the default. */
  supportedLocales: Locale[];
  /**
   * Optional URL-segment overrides: locale code → URL prefix. Use when the
   * recognizable URL segment differs from the ISO language code — e.g.
   * `{ uk: 'ua' }` serves Ukrainian at `/ua/*` while `hreflang` and
   * `<html lang>` correctly stay `uk`. Locales without an entry use their
   * own code as the prefix.
   */
  prefixes?: Record<Locale, string>;
}

/** The URL segment for a locale (alias if configured, else the code itself). */
function urlPrefix(locale: Locale, config: LocaleRoutingConfig): string {
  return config.prefixes?.[locale] ?? locale;
}

/** Locales that appear as a URL prefix = supported minus default. */
function prefixLocales(config: LocaleRoutingConfig): Locale[] {
  return config.supportedLocales.filter((l) => l !== config.defaultLocale);
}

/**
 * Split a pathname into its locale and the delocalized remainder.
 *
 * @example
 * extractLocale('/en/krakow', cfg)  // → { locale: 'en', pathname: '/krakow' }
 * extractLocale('/krakow', cfg)     // → { locale: 'pl', pathname: '/krakow' }
 * extractLocale('/en', cfg)         // → { locale: 'en', pathname: '/' }
 * extractLocale('/', cfg)           // → { locale: 'pl', pathname: '/' }
 */
export function extractLocale(
  pathname: string,
  config: LocaleRoutingConfig,
): { locale: Locale; pathname: string } {
  for (const locale of prefixLocales(config)) {
    const prefix = `/${urlPrefix(locale, config)}`;
    if (pathname === prefix) {
      return { locale, pathname: '/' };
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return { locale, pathname: pathname.slice(prefix.length) };
    }
  }
  return { locale: config.defaultLocale, pathname };
}

/**
 * Add the locale prefix to an internal path. Inverse of {@link extractLocale}.
 * The default locale is returned un-prefixed. External, hash, and protocol
 * links (anything not starting with a single '/') are returned untouched.
 *
 * Preserves query strings and hashes: only the path segment is prefixed.
 *
 * @example
 * localizeHref('/krakow', 'en', cfg)         // → '/en/krakow'
 * localizeHref('/krakow', 'pl', cfg)         // → '/krakow'
 * localizeHref('/', 'en', cfg)               // → '/en'
 * localizeHref('/krakow?style=hatha', 'en')  // → '/en/krakow?style=hatha'
 */
export function localizeHref(
  path: string,
  locale: Locale,
  config: LocaleRoutingConfig,
): string {
  // Only localize root-relative paths. Leave '//host', 'http…', '#x', 'mailto:'.
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (locale === config.defaultLocale) return path;
  if (!config.supportedLocales.includes(locale)) return path;

  const seg = urlPrefix(locale, config);
  // Guard against double-prefixing if a caller passes an already-localized path.
  if (path === `/${seg}` || path.startsWith(`/${seg}/`)) return path;

  return path === '/' ? `/${seg}` : `/${seg}${path}`;
}

/**
 * Build the `<link rel="alternate" hreflang>` set for a page, including
 * `x-default` (→ the default locale). Pass the DELOCALIZED canonical path
 * (i.e. `extractLocale(url.pathname).pathname`) and an absolute origin.
 *
 * @example
 * alternates('/krakow', cfg, 'https://szkolyjogi.pl')
 * // → [
 * //   { hreflang: 'pl', href: 'https://szkolyjogi.pl/krakow' },
 * //   { hreflang: 'en', href: 'https://szkolyjogi.pl/en/krakow' },
 * //   { hreflang: 'uk', href: 'https://szkolyjogi.pl/uk/krakow' },
 * //   { hreflang: 'x-default', href: 'https://szkolyjogi.pl/krakow' },
 * // ]
 */
export function alternates(
  path: string,
  config: LocaleRoutingConfig,
  origin: string,
): Array<{ hreflang: string; href: string }> {
  const base = origin.replace(/\/$/, '');
  const links = config.supportedLocales.map((locale) => ({
    hreflang: locale,
    href: base + localizeHref(path, locale, config),
  }));
  links.push({
    hreflang: 'x-default',
    href: base + localizeHref(path, config.defaultLocale, config),
  });
  return links;
}

/**
 * Pick the best supported locale from an `Accept-Language` header. Matches on
 * the primary subtag (`en-US` → `en`), honours quality weights, and falls back
 * to the default locale when nothing matches.
 *
 * @example
 * negotiateLocale('uk,en;q=0.8,pl;q=0.5', cfg)  // → 'uk'
 * negotiateLocale('fr-FR,fr;q=0.9', cfg)        // → 'pl' (default)
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  config: LocaleRoutingConfig,
): Locale {
  if (!acceptLanguage) return config.defaultLocale;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const weight = q ? parseFloat(q.slice(2)) : 1;
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        q: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((x) => x.base && x.q > 0)
    .sort((a, b) => b.q - a.q);

  const supported = new Set(config.supportedLocales.map((l) => l.toLowerCase()));
  for (const { base } of ranked) {
    if (supported.has(base)) {
      // Return the configured casing, not the header's.
      return config.supportedLocales.find((l) => l.toLowerCase() === base)!;
    }
  }
  return config.defaultLocale;
}

/**
 * Resolve the active locale for a request: URL prefix wins; if the path is
 * un-prefixed (the bare default root and below), fall back to content
 * negotiation. Use this in a server `handle` hook to set `event.locals.locale`.
 */
export function resolveLocale(
  input: { pathname: string; acceptLanguage?: string | null },
  config: LocaleRoutingConfig,
): Locale {
  const { locale, pathname } = extractLocale(input.pathname, config);
  // A real prefix was present → trust the URL.
  if (locale !== config.defaultLocale) return locale;
  // Only negotiate at the bare entry point; deeper un-prefixed paths are
  // canonical default-locale URLs and must stay on the default for crawlers.
  if (pathname === '/') return negotiateLocale(input.acceptLanguage, config);
  return config.defaultLocale;
}

/**
 * SvelteKit `reroute` hook factory: maps a prefixed URL onto the existing
 * (un-prefixed) route tree, so `/en/krakow` is served by the `/[city]` route
 * with no duplicate route files.
 *
 * @example
 * // src/hooks.ts
 * export const reroute = createReroute(i18nRoutingConfig);
 */
export function createReroute(config: LocaleRoutingConfig) {
  return ({ url }: { url: URL }): string =>
    extractLocale(url.pathname, config).pathname;
}
