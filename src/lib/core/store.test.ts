import { describe, it, expect } from 'vitest';
import { flushSync } from 'svelte';
import { createI18n } from './store.svelte.js';

describe('createI18n', () => {
	const sync = (locale: string) =>
		locale === 'en' ? { greeting: 'Hello {name}' } : { greeting: 'Witaj {name}' };

	it('sync loader applies messages synchronously during construction', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl'],
			loader: sync,
		});

		// No microtask / tick needed — message is there right away.
		expect(i18n.t('greeting', { name: 'Jan' })).toBe('Hello Jan');
		expect(i18n.isLoading).toBe(false);
	});

	it('sync loader setLocale also applies messages synchronously', async () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl'],
			loader: sync,
		});

		await i18n.setLocale('pl');
		expect(i18n.locale).toBe('pl');
		expect(i18n.t('greeting', { name: 'Jan' })).toBe('Witaj Jan');
	});

	it('returns the key itself when translation is missing', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: () => ({ known: 'Known' }),
		});

		expect(i18n.t('unknown.key')).toBe('unknown.key');
	});

	it('unwraps { default: {...} } from dynamic imports', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: () => ({ default: { hello: 'Hello' } }) as unknown as Record<string, string>,
		});
		expect(i18n.t('hello')).toBe('Hello');
	});

	it('async loader goes through isLoading state', async () => {
		let resolveFn: (msgs: Record<string, string>) => void = () => {};
		const pending = new Promise<Record<string, string>>((resolve) => {
			resolveFn = resolve;
		});

		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: () => pending,
		});

		expect(i18n.isLoading).toBe(true);
		expect(i18n.t('hi')).toBe('hi'); // fallback to key

		resolveFn({ hi: 'Hi!' });
		await pending;
		flushSync();

		expect(i18n.isLoading).toBe(false);
		expect(i18n.t('hi')).toBe('Hi!');
	});

	it('warns and no-ops on unsupported locale', async () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: sync,
		});
		const originalWarn = console.warn;
		const warnings: string[] = [];
		console.warn = (msg: string) => warnings.push(msg);
		try {
			await i18n.setLocale('xx');
		} finally {
			console.warn = originalWarn;
		}
		expect(i18n.locale).toBe('en');
		expect(warnings.length).toBe(1);
	});

	it('caches loaded locales (loader called once per locale)', async () => {
		let calls = 0;
		const loader = (locale: string) => {
			calls++;
			return { greeting: `${locale}-greeting` };
		};
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl'],
			loader,
		});
		expect(calls).toBe(1);
		await i18n.setLocale('pl');
		expect(calls).toBe(2);
		await i18n.setLocale('en');
		expect(calls).toBe(2); // cached
	});
});
