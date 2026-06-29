# Changelog

## 0.3.1 — 2026-06-29

### Security
- Bump vulnerable devDependencies to clear npm High CVE alerts: `vite` ^7.3.1 → ^7.3.5, `vitest` ^4.0.18 → ^4.1.0, `@sveltejs/kit` ^2.50.2 → ^2.60.1. No runtime deps affected.

## 0.3.0 — 2026-06-24

### Added
- **URL prefix aliases** — new optional `prefixes` field on `LocaleRoutingConfig` maps a locale code to a different URL segment. Use when the recognizable URL differs from the ISO language code, e.g. `{ uk: 'ua' }` serves Ukrainian at `/ua/*` while `hreflang` and `<html lang>` correctly stay `uk`. `extractLocale`, `localizeHref`, `createReroute`, `resolveLocale`, and `alternates` all honor the alias for URLs while emitting the real locale code for `hreflang`/lang. Locales without an entry use their own code (fully backward compatible). +9 tests.

## 0.2.0 — 2026-06-24

### Added
- **URL-locale routing** — a set of pure, SSR-safe helpers for path-prefix i18n (`/krakow` for the default locale, `/en/krakow`, `/uk/krakow` for the rest):
  - `extractLocale(pathname, cfg)` — split a URL into `{ locale, pathname }`. The default locale is never a valid prefix, so `/pl/x` is **not** treated as a duplicate of `/x`.
  - `localizeHref(path, locale, cfg)` — inverse: prefix non-default locales, preserve query/hash, leave external/`mailto:`/`#` links untouched, never double-prefix.
  - `alternates(path, cfg, origin)` — the full `<link rel="alternate" hreflang>` set including `x-default`.
  - `negotiateLocale(acceptLanguage, cfg)` — quality-weighted `Accept-Language` → best supported locale.
  - `resolveLocale({ pathname, acceptLanguage }, cfg)` — URL prefix wins; negotiate only at the bare root; deep un-prefixed paths stay on the default (crawler-stable).
  - `createReroute(cfg)` — drop-in SvelteKit `reroute` hook that maps prefixed URLs onto the existing route tree (no duplicate route files).
  - New type `LocaleRoutingConfig`.
- 41 unit tests for the routing helpers (extract/localize round-trips across all locales, query/hash preservation, `x-default`, `Accept-Language` weighting, the no-`/pl/`-duplicate invariant).
- Demo: new interactive **URL routing (SSR)** playground.

## 0.1.1 — 2026-06-17

### Changed
- Add `homepage` field pointing to the live demo (now shown as Homepage on npm).
- Add a live-demo link to the README.
- Ship the MIT `LICENSE` file in the published tarball (previously absent).

## 0.1.0 — 2026-04-23

Initial public release.

### Added
- **`createI18n(config)`** — runes-based i18n store. Returns an `I18nInstance` with reactive `locale`, `isLoading`, `supportedLocales`, plus `t()` and `setLocale()`.
- **Flat-key translations** — keys are plain strings (e.g. `"nav.home"`), not nested paths. One `Map` lookup per `t()` call.
- **`{variable}` interpolation** — `interpolate(template, params)` is also exported standalone. Missing params are left in-place; numeric values coerce to string; repeated placeholders all substitute.
- **Async or sync loader** — `loader(locale)` can return a `Messages` object directly or a promise. Synchronous loaders apply messages immediately (no microtask, no `isLoading` flash — critical for SSR-rendered first paint). Handles both `{ default: {...} }` (dynamic JSON imports) and plain objects. Messages are cached per locale.
- **Missing-key transparency** — `t(key)` returns the key itself when the translation is missing, making gaps easy to spot visually.
- **`<LocaleSwitcher />`** — minimal drop-in `<select>` component. Optional `labels` map, optional `class` prop, `disabled` bound to `i18n.isLoading`. Styles via `--asini-*` CSS variables.
- **Types** — `Locale`, `Messages`, `MessageLoader`, `I18nConfig`, `I18nInstance`.
- 17 unit tests — 10 for `interpolate()` (missing params, numerics, zero, repeated placeholders, edge cases) and 7 for `createI18n()` (sync application, async loading state, caching, unsupported-locale warnings, missing-key fallback, `{ default }` unwrapping).
