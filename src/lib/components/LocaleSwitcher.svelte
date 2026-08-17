<script lang="ts">
  import type { Locale, I18nInstance } from "../core/types.js";
  import { extractLocale, localizeHref, type LocaleRoutingConfig } from "../core/routing.js";

  interface Props {
    /**
     * The i18n instance created by createI18n().
     */
    i18n: I18nInstance;
    /**
     * Optional display name map, e.g. { en: 'English', pl: 'Polski' }.
     * Falls back to the locale code itself if not provided.
     */
    labels?: Record<Locale, string>;
    /**
     * Optional CSS class for the wrapper.
     */
    class?: string;
    /**
     * URL-locale routing config. When given, switching navigates to the same
     * page under the new locale prefix and remembers the choice in the
     * `locale` cookie (the one `createLocaleHandle` reads), so the server and
     * the next request agree. Without it the switch is in-memory only.
     */
    routing?: LocaleRoutingConfig;
    /**
     * Path prefixes served without a locale prefix (mirror `createLocaleHandle`'s
     * `unprefixed`). There the page reloads in place and the cookie carries the choice.
     */
    unprefixed?: string[];
  }

  let { i18n, labels, class: className = "", routing, unprefixed = [] }: Props = $props();

  function handleChange(e: Event) {
    const locale = (e.target as HTMLSelectElement).value;
    i18n.setLocale(locale);
    if (!routing || typeof window === "undefined") return;
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    const { pathname, search, hash } = window.location;
    const isApp = unprefixed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const target = isApp
      ? pathname
      : localizeHref(extractLocale(pathname, routing).pathname, locale, routing);
    window.location.assign(target + search + hash);
  }
</script>

<select
  name="locale"
  class="asini-locale-switcher {className}"
  value={i18n.locale}
  onchange={handleChange}
  aria-label="Select language"
  disabled={i18n.isLoading}
>
  {#each i18n.supportedLocales as loc (loc)}
    <option value={loc}>{labels?.[loc] ?? loc.toUpperCase()}</option>
  {/each}
</select>

<style>
  .asini-locale-switcher {
    font-family: var(--asini-font-sans, inherit);
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--asini-border, #ccc);
    border-radius: var(--asini-radius-sm, 4px);
    background: var(--asini-surface, #fff);
    color: var(--asini-text, #000);
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .asini-locale-switcher:hover {
    border-color: var(--asini-border-strong, #999);
  }

  .asini-locale-switcher:focus {
    outline: 2px solid var(--asini-accent, #0066cc);
    outline-offset: 1px;
  }

  .asini-locale-switcher:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  /* Native dropdown options inherit the select's text color, but the popup
     background is UA-controlled. Pin both so consumers that restyle the
     select (e.g. white text over a hero image) don't get unreadable options. */
  .asini-locale-switcher option {
    background: var(--asini-surface, #fff);
    color: var(--asini-text, #000);
  }
</style>
