# @nomideusz/svelte-i18n

[![npm](https://badgen.net/npm/v/@nomideusz/svelte-i18n)](https://www.npmjs.com/package/@nomideusz/svelte-i18n) [![license](https://badgen.net/badge/license/MIT/blue)](https://github.com/nomideusz/svelte-i18n/blob/main/LICENSE)

Minimal runtime-independent i18n for **Svelte 5** — a runes-based locale store, flat JSON messages, `{variable}` interpolation, and a tiny `<LocaleSwitcher />` component. No build-time code generation, no ICU message format, no global side effects.

**[Live demo → svelte-i18n-five.vercel.app](https://svelte-i18n-five.vercel.app/)**

> **Stable since 1.0.** The API below is a promise: from here, anything that breaks a consumer costs a major version.

## Install

```bash
pnpm add @nomideusz/svelte-i18n
```

> Requires Svelte 5 (`^5.0.0`). Zero runtime dependencies.

## Quick start

Create one i18n instance per app, point it at a loader function, import it anywhere:

```ts
// src/lib/i18n.ts
import { createI18n } from '@nomideusz/svelte-i18n';

import en from './messages/en.json';
import pl from './messages/pl.json';
import de from './messages/de.json';

const messages = { en, pl, de };

export const i18n = createI18n({
  defaultLocale: 'en',
  supportedLocales: ['en', 'pl', 'de'],
  // Synchronous: messages are there on the first render, which is what makes
  // per-request SSR locales safe. Async loaders work too — see below.
  loader: (locale) => messages[locale] ?? messages.en,
});
```

```jsonc
// src/lib/messages/en.json
{
  "nav.home": "Home",
  "nav.about": "About",
  "greeting": "Hello {name}, you have {count} messages."
}
```

```svelte
<script lang="ts">
  import { i18n } from '#lib/i18n';
</script>

<h1>{i18n.t('greeting', { name: 'Jan', count: 3 })}</h1>
<a href="/">{i18n.t('nav.home')}</a>
```

`i18n.locale`, `i18n.isLoading`, and `i18n.supportedLocales` are Svelte 5 `$state`-backed — read them directly in components and they'll update reactively.

## Why flat keys?

Keys are flat strings like `"nav.home"` — **the dots are just part of the string**, not a nested path. That keeps the hot path tiny (single `Map` lookup, no recursion) and means JSON files stay linter- and translation-tool-friendly:

```jsonc
{
  "nav.home": "Home",
  "nav.about": "About",
  "billing.invoice.number": "Invoice #{number}"
}
```

If a key is missing, `t()` returns the key itself — easy to spot untranslated strings at a glance.

## Switching locales

```svelte
<script lang="ts">
  import { i18n } from '#lib/i18n';
</script>

<button onclick={() => i18n.setLocale('pl')}>Polski</button>
<button onclick={() => i18n.setLocale('de')}>Deutsch</button>

{#if i18n.isLoading}
  <span>Loading…</span>
{:else}
  <p>{i18n.t('current')} {i18n.locale}</p>
{/if}
```

`setLocale()` returns a promise that resolves once the new messages are loaded. Each locale is loaded once and cached — switching back to a previously-loaded locale is instant.

Attempting to switch to an unsupported locale logs a warning and does nothing.

## `<LocaleSwitcher />`

A minimal drop-in `<select>`:

```svelte
<script lang="ts">
  import { LocaleSwitcher } from '@nomideusz/svelte-i18n';
  import { i18n } from '#lib/i18n';
</script>

<LocaleSwitcher
  {i18n}
  labels={{ en: 'English', pl: 'Polski', de: 'Deutsch' }}
/>
```

Without `labels`, each locale renders as its uppercase code (`EN`, `PL`, `DE`). The `disabled` state is wired to `i18n.isLoading` so users can't spam-switch while messages are still loading. Every switch writes the choice to the `locale` cookie — the one `createLocaleHandle` reads — so it survives a reload.

Set `label` to translate the control's accessible name; it defaults to English because something has to be there, and in an i18n library that string should not be the one you cannot change:

```svelte
<LocaleSwitcher {i18n} label={i18n.t('a11y.language')} />
```

With URL-locale routing, pass the routing config so a switch also navigates (`/krakow` → `/en/krakow`); `unprefixed` mirrors the handle's option for areas without a prefix (those reload in place):

```svelte
<LocaleSwitcher {i18n} {routing} unprefixed={['/admin']} />
```

Style via CSS variables on an ancestor — `--asini-font-sans`, `--asini-border`, `--asini-border-strong`, `--asini-surface`, `--asini-text`, `--asini-accent`, `--asini-radius-sm` — or pass a `class` prop and override styles directly:

```svelte
<LocaleSwitcher {i18n} class="my-switcher" />
```

## Interpolation

`{variable}` placeholders get substituted with values from the second argument to `t()`:

```ts
i18n.t('greeting', { name: 'Jan', count: 3 });
// → "Hello Jan, you have 3 messages."
```

Rules:
- Missing params are left in-place (`{name}` stays `{name}`)
- Numeric values coerce to string — `{ count: 0 }` renders `"0"`
- Repeated placeholders all substitute (`"{x} + {x} = {y}"`)
- No template can render — placeholders must be `\w+` (letters, digits, underscore)

If you need the interpolation logic standalone:

```ts
import { interpolate } from '@nomideusz/svelte-i18n';

interpolate('Hello {name}', { name: 'Jan' }); // → 'Hello Jan'
```

## Plurals

Pass a numeric `count` and `t()` picks the CLDR plural form for the active locale — no ICU parser, no dependency; `Intl.PluralRules` does the selecting.

```jsonc
// pl.json — Polish needs three forms
{
  "school_one": "{count} szkoła",
  "school_few": "{count} szkoły",
  "school_many": "{count} szkół",
  "school_other": "{count} szkoły"
}
```

```ts
i18n.t('school', { count: 1 });  // → "1 szkoła"
i18n.t('school', { count: 3 });  // → "3 szkoły"
i18n.t('school', { count: 12 }); // → "12 szkół"
```

Rules:
- Suffixes are the CLDR categories: `_zero`, `_one`, `_two`, `_few`, `_many`, `_other`. Author only the ones your language uses — English needs `_one` and `_other`, Polish needs `_one`/`_few`/`_many`.
- **`_other` is the required fallback.** If the selected category has no key, `_other` is used; if that is missing too, `t()` returns the key.
- **An exact key always wins.** `"school": "…"` beats every suffixed variant, so adding plurals never changes an existing call.
- `count` is interpolated like any other param — `{count}` in the message renders the number.

## Sync vs. async loaders

The loader can return a `Messages` object directly **or** a promise. Sync loaders are applied immediately during construction — no microtask, no `isLoading` flash — so SSR-rendered first paint includes the default locale's messages. Async loaders flip `isLoading` to `true` while they resolve. Both `{ default: {...} }` (what dynamic JSON imports produce) and plain objects are accepted:

```ts
// Bundled into the app (no code-splitting)
import en from './messages/en.json';
import pl from './messages/pl.json';

createI18n({
  defaultLocale: 'en',
  supportedLocales: ['en', 'pl'],
  loader: (locale) => (locale === 'pl' ? pl : en),
});

// Split into per-locale chunks. Note the SSR caveat below: under per-request
// server rendering, prefer the synchronous form above.

createI18n({
  defaultLocale: 'en',
  supportedLocales: ['en', 'pl', 'de', 'uk'],
  loader: (locale) => import(`./messages/${locale}.json`),
});

// Loaded from a remote source
createI18n({
  defaultLocale: 'en',
  supportedLocales: ['en', 'pl'],
  loader: async (locale) => {
    const res = await fetch(`/messages/${locale}.json`);
    return res.json();
  },
});
```

## Locale-aware formatting

`formatDateTime`, `formatMoney`, and `intlLocale` are **pure, store-free functions** — no Svelte, no reactive state — so the same call works in components, `load` functions, server hooks, and email templates, where the reactive locale in `createI18n` would race under concurrent per-request (or per-recipient) rendering. Pages and emails share one regional policy.

```ts
import { formatDateTime, formatMoney, intlLocale } from '@nomideusz/svelte-i18n';

const d = new Date('2026-06-15T16:00:00Z');

formatDateTime(d, 'en', 'Europe/Warsaw'); // → "Monday, 15 June 2026 at 18:00"
formatDateTime(d, 'en-US', 'UTC');        // → "Monday, June 15, 2026 at 04:00 PM"

formatMoney(9000, 'PLN', 'pl'); // → "90,00 zł"
formatMoney(9000, 'JPY', 'en'); // → "JP¥9,000" — not ¥90

intlLocale('en');    // → "en-GB"
intlLocale('en-US'); // → "en-US" (a tag with a region is trusted as-is)
```

- **`intlLocale(locale)`** gives bare locale codes a regional default: `en → en-GB`, `pl → pl-PL`, `uk → uk-UA`. The one that earns its keep is `en → en-GB`: bare `'en'` makes `Intl` pick US conventions (`6/15/2026`, 12-hour clock), which is wrong for a European audience and easy to ship without noticing. Tags that already carry a region (`en-US`, `de-AT`) are trusted as-is; unknown bare codes (`de`) pass through rather than guessing. Both formatters call it internally, so bare app locales just work.
- **`formatDateTime(date, locale, timeZone?)`** renders weekday, full date and time — the "when is this happening" rendering. Pass an IANA `timeZone` (e.g. `'Europe/Warsaw'`) whenever the code may run on a machine whose zone differs from the reader's — i.e. always on servers.
- **`formatMoney(minorUnits, currency, locale)`** takes money as **integer minor units** (grosze, cents). The divisor is derived from the currency via `Intl.NumberFormat` rather than hardcoded to 100 — JPY has no minor unit, so `9000` is ¥9,000, not ¥90.

## URL-locale routing (SSR)

For SEO you usually want each locale on its own crawlable URL — `/about` for the default locale, `/en/about` and `/uk/about` for the rest — with `hreflang` tags tying them together. The routing helpers are **pure functions** (no Svelte, no global state), so they run identically in `hooks`, `load`, and the browser.

Strategy: **path prefix with a bare default locale**. The default locale is never a valid prefix, so `/pl/about` is treated as an ordinary path, not a duplicate of `/about`.

```ts
// src/lib/i18n-routing.ts
import type { LocaleRoutingConfig } from '@nomideusz/svelte-i18n';

export const routing: LocaleRoutingConfig = {
  defaultLocale: 'pl',
  supportedLocales: ['pl', 'en', 'uk'],
};
```

### URL prefix aliases

When the recognizable URL segment differs from the ISO language code, map it with `prefixes`. The classic case is Ukrainian: users recognize `/ua/`, but the language code (and therefore `hreflang` and `<html lang>`) must stay `uk`.

```ts
export const routing: LocaleRoutingConfig = {
  defaultLocale: 'pl',
  supportedLocales: ['pl', 'en', 'uk'],
  prefixes: { uk: 'ua' }, // URL: /ua/krakow — hreflang & lang: "uk"
};
```

`extractLocale('/ua/krakow', routing)` → `{ locale: 'uk', pathname: '/krakow' }`, `localizeHref('/krakow', 'uk', routing)` → `/ua/krakow`, and `alternates(...)` emits `hreflang="uk"` pointing at the `/ua/` URL. Locales without a `prefixes` entry use their own code. `negotiateLocale` is unaffected — `Accept-Language` always carries language codes (`uk`), not URL segments.

### `reroute` — serve prefixed URLs from the existing route tree

```ts
// src/hooks.ts
import { createReroute } from '@nomideusz/svelte-i18n';
import { routing } from '#lib/i18n-routing';

export const reroute = createReroute(routing);
// /en/krakow → resolved by the /[city] route; no duplicate route files
```

### Resolve the per-request locale on the server

```ts
// src/hooks.server.ts
import { createLocaleHandle } from '@nomideusz/svelte-i18n';
import { routing } from '#lib/i18n-routing';

// Optional: areas served without a locale prefix (admin, auth) — there the
// locale is a preference (cookie, else Accept-Language) and never written back.
export const handle = createLocaleHandle(routing, { unprefixed: ['/admin'] });
```

Per request the handle:

- redirects a bare-root (`/`) visitor to their locale's home when it is not the default (cookie preference, else `Accept-Language`), **keeping the query string** — `/` is where ad traffic lands and `utm`/`gclid` must survive the hop;
- resolves the locale from the URL prefix and sets `event.locals.locale`;
- keeps the `locale` cookie in sync — but **only where the URL decided the locale**: a prefixed path, or the bare root. An un-prefixed path says nothing about a locale, so the default locale is an assumption there, and writing it would erase a preference the visitor made elsewhere;
- ignores a cookie naming a locale you no longer serve (left in, it would suppress the redirect and let the canonical `/` serve a negotiated language);
- replaces `%lang%` in `app.html`, and sends `Vary: accept-language, cookie` on the bare root — the one path whose response depends on who is asking.

Cookie-less visitors on the default locale get no `Set-Cookie`, so their responses stay CDN-cacheable. Compose it with `sequence()` from `@sveltejs/kit/hooks` and declare `locale: string` in `App.Locals`.

The lower-level `resolveLocale({ pathname, acceptLanguage }, routing)` is exported too: URL prefix wins; `Accept-Language` is only consulted at the bare root, so deep un-prefixed paths stay on the default locale and remain stable for crawlers.

### Localize links and emit `hreflang`

```svelte
<script lang="ts">
  import { extractLocale, localizeHref, alternates } from '@nomideusz/svelte-i18n';
  import { routing } from '#lib/i18n-routing';
  import { page } from '$app/state';

  // The canonical, locale-stripped path for the current page:
  const path = $derived(extractLocale(page.url.pathname, routing).pathname);
  const links = $derived(alternates(path, routing, 'https://example.com'));
</script>

<svelte:head>
  {#each links as { hreflang, href }}
    <link rel="alternate" {hreflang} {href} />
  {/each}
</svelte:head>

<a href={localizeHref('/krakow', page.data.locale, routing)}>Kraków</a>
```

> SSR tip: pair this with a **synchronous** message loader and set `i18n.setLocale(locale)` from server data at the top of your root layout. Because SvelteKit's render pass is synchronous and non-interleaved, the singleton store resolves to the right locale per request without `AsyncLocalStorage` or context plumbing.

### When the locale is a preference, not a URL

Staff tools, admin panels and `noindex` pages have nothing to gain from crawlable per-locale URLs. There `createLocaleHandle` is the wrong shape — it exists to make a URL prefix authoritative. Read the cookie instead; it is the same one `<LocaleSwitcher />` writes:

```ts
// src/hooks.server.ts
import { LOCALE_COOKIE } from '@nomideusz/svelte-i18n';
import { i18n } from '#lib/i18n';

export const handle: Handle = async ({ event, resolve }) => {
  const cookie = event.cookies.get(LOCALE_COOKIE);
  event.locals.locale = i18n.supportedLocales.includes(cookie ?? '') ? cookie! : 'pl';

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale),
  });
};
```

```ts
// src/routes/+layout.server.ts
export const load = ({ locals }) => ({ locale: locals.locale });
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { i18n } from '#lib/i18n';
  let { data, children } = $props();

  // Synchronous, so SSR's first paint is already in the right language. Read
  // once on purpose: after hydration the switcher owns the locale, and
  // re-applying the server's value would undo the visitor's choice.
  untrack(() => i18n.setLocale(data.locale));
</script>
```

That is the whole recipe — no routing config, no prefixes, no redirect.

## API reference

### Routing helpers

```ts
interface LocaleRoutingConfig {
  defaultLocale: string;
  supportedLocales: string[];
  /** Optional locale code → URL segment overrides, e.g. { uk: 'ua' }. */
  prefixes?: Record<string, string>;
}
```

| Function | Returns | Description |
|----------|---------|-------------|
| `extractLocale(pathname, cfg)` | `{ locale, pathname }` | Split a URL into its locale and delocalized path. Default locale is never a prefix. |
| `localizeHref(path, locale, cfg)` | `string` | Add the locale prefix (default locale → unchanged). Preserves query/hash; ignores external/`mailto:`/`#`; never double-prefixes **the same** locale — delocalize with `extractLocale` first when switching. |
| `alternates(path, cfg, origin)` | `{ hreflang, href }[]` | `hreflang` link set for every locale plus `x-default`. Pass the delocalized path. |
| `negotiateLocale(acceptLanguage, cfg)` | `string` | Best supported locale from `Accept-Language` (quality-weighted, primary-subtag match). Falls back to default. |
| `resolveLocale({ pathname, acceptLanguage }, cfg)` | `string` | URL prefix wins; negotiate only at the bare root; deep un-prefixed paths stay default. |
| `createReroute(cfg)` | `({ url }) => string` | SvelteKit `reroute` hook — maps prefixed URLs onto the un-prefixed route tree. |
| `createLocaleHandle(cfg, { unprefixed? })` | SvelteKit `Handle` | Server hook: bare-root redirect, `locals.locale`, cookie sync, `%lang%`. |
| `LOCALE_COOKIE` | `'locale'` | The preference cookie the handle and `<LocaleSwitcher />` share. |

### `createI18n(config)`

```ts
interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  loader: (locale: string) => Promise<Messages> | Messages;
}

type Messages = Record<string, string>;
```

Returns an `I18nInstance`:

| Member | Type | Description |
|--------|------|-------------|
| `locale` | `string` | Current locale (reactive) |
| `isLoading` | `boolean` | True while loading a new locale (reactive) |
| `supportedLocales` | `string[]` | The list passed to config |
| `t(key, params?)` | `(string, obj?) => string` | Translate, interpolate `{vars}`, and select a CLDR plural form when `params.count` is a number. Missing keys return the key itself. |
| `setLocale(locale)` | `(string) => Promise<void>` | Switch locale. Warns and no-ops if unsupported. |

### `interpolate(template, params?)`

```ts
interpolate(template: string, params?: Record<string, string | number>): string
```

Substitutes `{var}` placeholders in `template`. Missing params left as-is.

### Formatting helpers

Pure and store-free — importable anywhere, server included.

| Function | Returns | Description |
|----------|---------|-------------|
| `intlLocale(locale)` | `string` | Regional default for bare codes (`en → en-GB`, `pl → pl-PL`, `uk → uk-UA`); region-carrying tags and unknown codes pass through. |
| `formatDateTime(date, locale, timeZone?)` | `string` | Weekday + full date + time in the locale's conventions (24-hour for `en-GB`). Optional IANA time zone. |
| `formatMoney(minorUnits, currency, locale)` | `string` | Integer minor units → localized currency string; divisor derived from the currency, not hardcoded to 100. |

### `<LocaleSwitcher />`

| Prop | Type | Description |
|------|------|-------------|
| `i18n` | `I18nInstance` | *required* |
| `labels` | `Record<string, string>` | Optional locale code → display name map |
| `class` | `string` | Optional CSS class on the `<select>` |
| `label` | `string` | Accessible name for the control (default `'Select language'`) |
| `routing` | `LocaleRoutingConfig` | Also navigate to the same page under the new locale's prefix |
| `unprefixed` | `string[]` | Mirrors `createLocaleHandle`'s option — those areas reload in place |

Every switch writes the `locale` cookie (exported as `LOCALE_COOKIE`), with or without `routing`.

## Development

```bash
pnpm install
pnpm dev             # SvelteKit dev server (demo)
pnpm check           # Typecheck
pnpm test            # Vitest
pnpm run package     # Build the library
```

## License

MIT
