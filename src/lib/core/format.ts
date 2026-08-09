/**
 * Locale-aware formatting. Pure functions, no store — safe on the server under
 * concurrent per-request (or per-recipient) rendering, where the reactive
 * locale in `createI18n` would race.
 */

/**
 * Regional defaults for the bare locale codes this monorepo uses.
 *
 * The one that earns its keep is `en → en-GB`: bare `'en'` makes Intl pick US
 * conventions (`6/15/2026`, 12-hour), which is wrong for a European audience
 * and easy to ship without noticing. Pass a full tag (`'en-US'`) to override —
 * anything already carrying a region is trusted as-is.
 */
const REGION_DEFAULTS: Record<string, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
};

export function intlLocale(locale: string): string {
  if (locale.includes('-')) return locale;
  return REGION_DEFAULTS[locale.toLowerCase()] ?? locale;
}

/** Weekday, full date and time — the "when is this happening" rendering. */
export function formatDateTime(date: Date, locale: string, timeZone?: string): string {
  return date.toLocaleString(intlLocale(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Money held as integer minor units (the only sane way to store it).
 *
 * The divisor comes from the currency rather than being a hardcoded 100 —
 * JPY has no minor unit, so `9000` is ¥9,000, not ¥90.
 */
export function formatMoney(minorUnits: number, currency: string, locale: string): string {
  const tag = intlLocale(locale);
  const formatter = new Intl.NumberFormat(tag, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().minimumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** digits);
}
