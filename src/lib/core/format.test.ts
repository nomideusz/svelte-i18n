import { describe, it, expect } from 'vitest';
import { intlLocale, formatDateTime, formatMoney } from './format.js';

describe('intlLocale', () => {
	it('gives bare codes a regional default', () => {
		// Bare 'en' would make Intl pick US conventions — the whole point of the map.
		expect(intlLocale('en')).toBe('en-GB');
		expect(intlLocale('pl')).toBe('pl-PL');
		expect(intlLocale('uk')).toBe('uk-UA');
	});

	it('trusts a tag that already carries a region', () => {
		expect(intlLocale('en-US')).toBe('en-US');
		expect(intlLocale('de-AT')).toBe('de-AT');
	});

	it('passes unknown bare codes through rather than guessing', () => {
		expect(intlLocale('de')).toBe('de');
	});
});

describe('formatDateTime', () => {
	const d = new Date('2026-06-15T16:00:00Z');

	it('renders in the requested time zone, not the server default', () => {
		expect(formatDateTime(d, 'pl', 'Europe/Warsaw')).toContain('18:00');
		expect(formatDateTime(d, 'pl', 'UTC')).toContain('16:00');
	});

	it('uses 24-hour time for en, because en means en-GB here', () => {
		const gb = formatDateTime(d, 'en', 'UTC');
		expect(gb).toContain('16:00');
		expect(gb).not.toMatch(/pm/i);
	});

	it('still honours an explicit US tag', () => {
		expect(formatDateTime(d, 'en-US', 'UTC')).toMatch(/PM/i);
	});
});

describe('formatMoney', () => {
	it('treats the input as integer minor units', () => {
		expect(formatMoney(9000, 'PLN', 'pl')).toContain('90,00');
	});

	it('scales by the currency, not a hardcoded 100', () => {
		// JPY has no minor unit: 9000 is ¥9,000, not ¥90.
		expect(formatMoney(9000, 'JPY', 'en')).toContain('9,000');
		expect(formatMoney(9000, 'JPY', 'en')).not.toContain('90.00');
	});

	it('formats zero rather than dropping it', () => {
		expect(formatMoney(0, 'EUR', 'en')).toMatch(/0[.,]00/);
	});
});
