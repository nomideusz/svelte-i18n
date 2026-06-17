# @nomideusz/svelte-i18n

Minimal runtime-independent i18n for **Svelte 5** — a runes-based locale store, flat JSON messages, `{variable}` interpolation, and a tiny `<LocaleSwitcher />` component. No build-time code generation, no ICU message format, no global side effects.

**[Live demo → svelte-i18n-five.vercel.app](https://svelte-i18n-five.vercel.app/)**

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

export const i18n = createI18n({
  defaultLocale: 'en',
  supportedLocales: ['en', 'pl', 'de'],
  // Dynamic imports = each locale is its own chunk, loaded on demand
  loader: (locale) => import(`./messages/${locale}.json`),
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
  import { i18n } from '$lib/i18n';
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
  import { i18n } from '$lib/i18n';
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
  import { i18n } from '$lib/i18n';
</script>

<LocaleSwitcher
  {i18n}
  labels={{ en: 'English', pl: 'Polski', de: 'Deutsch' }}
/>
```

Without `labels`, each locale renders as its uppercase code (`EN`, `PL`, `DE`). The `disabled` state is wired to `i18n.isLoading` so users can't spam-switch while messages are still loading.

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

// Split into per-locale chunks (recommended for large apps)
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

## API reference

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
| `t(key, params?)` | `(string, obj?) => string` | Translate. Missing keys return the key itself. |
| `setLocale(locale)` | `(string) => Promise<void>` | Switch locale. Warns and no-ops if unsupported. |

### `interpolate(template, params?)`

```ts
interpolate(template: string, params?: Record<string, string | number>): string
```

Substitutes `{var}` placeholders in `template`. Missing params left as-is.

### `<LocaleSwitcher />`

| Prop | Type | Description |
|------|------|-------------|
| `i18n` | `I18nInstance` | *required* |
| `labels` | `Record<string, string>` | Optional locale code → display name map |
| `class` | `string` | Optional CSS class on the `<select>` |

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
