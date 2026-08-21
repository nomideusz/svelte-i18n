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

describe('plural selection via count', () => {
	const catalogs: Record<string, Record<string, string>> = {
		pl: {
			school_one: 'szkoła',
			school_few: 'szkoły',
			school_many: 'szkół',
			entries_other: '{count} wejść',
		},
		en: {
			school_one: 'school',
			school_other: 'schools',
			school: 'exact wins',
		},
	};
	const make = (defaultLocale: string) =>
		createI18n({
			defaultLocale,
			supportedLocales: ['en', 'pl'],
			loader: (l) => catalogs[l],
		});

	it('picks the Polish one/few/many forms, mod-100 rules included', () => {
		const i18n = make('pl');
		expect(i18n.t('school', { count: 1 })).toBe('szkoła');
		expect(i18n.t('school', { count: 3 })).toBe('szkoły');
		expect(i18n.t('school', { count: 5 })).toBe('szkół');
		expect(i18n.t('school', { count: 12 })).toBe('szkół'); // 12 is many, not few
		expect(i18n.t('school', { count: 22 })).toBe('szkoły'); // 22 is few again
	});

	it('picks English one/other', async () => {
		const i18n = make('pl');
		await i18n.setLocale('en');
		expect(i18n.t('school_one')).toBe('school'); // suffixed keys still work verbatim
	});

	it('an exact key beats plural expansion', async () => {
		const i18n = make('en');
		expect(i18n.t('school', { count: 2 })).toBe('exact wins');
	});

	it('falls back to _other when the category key is missing, and interpolates count', () => {
		const i18n = make('pl');
		expect(i18n.t('entries', { count: 7 })).toBe('7 wejść');
	});

	it('still returns the key when nothing matches', () => {
		const i18n = make('pl');
		expect(i18n.t('nothing_here', { count: 2 })).toBe('nothing_here');
	});

	// ── regressions locked down for 1.0 ────────────────────────────────

	it('a catalog key literally named "default" is a key, not a module namespace', () => {
		// Truthiness would take the string "Domyślny" for the whole catalog and
		// every key would render as itself.
		const i18n = createI18n({
			defaultLocale: 'pl',
			supportedLocales: ['pl'],
			loader: () => ({ default: 'Domyślny', save: 'Zapisz' }),
		});

		expect(i18n.t('save')).toBe('Zapisz');
		expect(i18n.t('default')).toBe('Domyślny');
	});

	it('unwraps a real module namespace', async () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: async () => ({ default: { greeting: 'Hello {name}' } }),
		});

		await i18n.setLocale('en');
		expect(i18n.t('greeting', { name: 'Jan' })).toBe('Hello Jan');
	});

	it('inherited Object keys are not messages', () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en'],
			loader: () => ({ known: 'Known' }),
		});

		// Returned Object.prototype.constructor before the own-key guard — a
		// function where the signature promises a string.
		expect(i18n.t('constructor')).toBe('constructor');
		expect(i18n.t('toString')).toBe('toString');
		expect(i18n.t('__proto__')).toBe('__proto__');
	});

	it('a slow load for an abandoned locale never overwrites the current one', async () => {
		const delays: Record<string, number> = { pl: 40, de: 1 };
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl', 'de'],
			loader: (locale) =>
				new Promise((r) =>
					setTimeout(() => r({ hi: `hi-${locale}` }), delays[locale] ?? 1),
				),
		});

		const slow = i18n.setLocale('pl');
		await i18n.setLocale('de');
		expect(i18n.t('hi')).toBe('hi-de');

		await slow;
		expect(i18n.locale).toBe('de');
		expect(i18n.t('hi')).toBe('hi-de');
		expect(i18n.isLoading).toBe(false);
	});

	it('concurrent callers for the same locale share one load', async () => {
		const calls: string[] = [];
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl'],
			loader: (locale) => {
				calls.push(locale);
				return new Promise((r) => setTimeout(() => r({ hi: `hi-${locale}` }), 5));
			},
		});

		// The documented SSR recipe: the layout sets the locale while the eager
		// default load is still in flight.
		await i18n.setLocale('en');
		expect(calls).toEqual(['en']);
	});

	it('a failed switch does not claim the locale it could not load', async () => {
		const i18n = createI18n({
			defaultLocale: 'en',
			supportedLocales: ['en', 'pl'],
			loader: (locale) =>
				locale === 'pl' ? Promise.reject(new Error('offline')) : { hi: 'Hi' },
		});

		await expect(i18n.setLocale('pl')).rejects.toThrow('offline');
		expect(i18n.locale).toBe('en');
		expect(i18n.t('hi')).toBe('Hi');
	});

	it('a rejecting eager load is handled, not thrown at module scope', async () => {
		// Node kills the SSR process on an unhandled rejection; createI18n runs at
		// module scope in every consumer.
		const seen: unknown[] = [];
		const onUnhandled = (err: unknown) => seen.push(err);
		process.on('unhandledRejection', onUnhandled);
		try {
			createI18n({
				defaultLocale: 'en',
				supportedLocales: ['en'],
				loader: () => Promise.reject(new Error('network down')),
			});
			await new Promise((r) => setTimeout(r, 20));
			expect(seen).toEqual([]);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});
});
