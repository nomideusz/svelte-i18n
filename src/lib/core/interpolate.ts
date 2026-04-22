// packages/svelte-i18n/src/lib/core/interpolate.ts

/**
 * Replace {variable} placeholders in a string with values from params.
 * Missing params are left as-is (e.g. "{name}" stays if name not provided).
 *
 * @example
 * interpolate("Hello {name}, you have {count} items", { name: "Jan", count: 3 })
 * // → "Hello Jan, you have 3 items"
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}
