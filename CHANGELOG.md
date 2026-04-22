# Changelog

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
