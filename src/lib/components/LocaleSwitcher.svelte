<script lang="ts">
  import type { Locale, I18nInstance } from "../core/types.js";

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
  }

  let { i18n, labels, class: className = "" }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    i18n.setLocale(target.value);
  }
</script>

<select
  class="asini-locale-switcher {className}"
  value={i18n.locale}
  onchange={handleChange}
  aria-label="Select language"
  disabled={i18n.isLoading}
>
  {#each i18n.supportedLocales as loc}
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
</style>
