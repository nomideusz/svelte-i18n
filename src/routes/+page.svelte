<script lang="ts">
	import {
		createI18n,
		interpolate,
		LocaleSwitcher,
		extractLocale,
		localizeHref,
		alternates,
		type LocaleRoutingConfig,
	} from '$lib/index.js';
	import { loader, LOCALE_LABELS } from './messages/index.js';

	const i18n = createI18n({
		defaultLocale: 'en',
		supportedLocales: ['en', 'pl', 'de', 'uk'],
		loader,
	});

	// ── Interpolate playground ──────────────────────────
	let template = $state('Hello {name}, you have {count} unread messages.');
	let paramsJson = $state('{\n  "name": "Jan",\n  "count": 3\n}');
	const parsedParams = $derived.by(() => {
		try {
			const parsed = JSON.parse(paramsJson);
			if (parsed && typeof parsed === 'object') {
				return parsed as Record<string, string | number>;
			}
		} catch {
			/* invalid JSON */
		}
		return null;
	});
	const interpolated = $derived(
		parsedParams ? interpolate(template, parsedParams) : interpolate(template),
	);
	const placeholders = $derived.by(() => {
		const out: string[] = [];
		const re = /\{(\w+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(template)) !== null) {
			if (!out.includes(m[1])) out.push(m[1]);
		}
		return out;
	});
	const parseError = $derived(parsedParams === null && paramsJson.trim().length > 0);

	// ── t() playground ──────────────────────────────────
	const T_PRESETS: Array<{ key: string; params?: Record<string, string | number> }> = [
		{ key: 'nav.home' },
		{ key: 'hero.title' },
		{ key: 'greeting.welcome', params: { name: 'Jan' } },
		{ key: 'greeting.notifications', params: { count: 7 } },
		{ key: 'billing.total', params: { amount: '129', currency: 'PLN' } },
		{ key: 'nonexistent.key' },
	];

	function paramsFor(key: string): string {
		const preset = T_PRESETS.find((p) => p.key === key);
		return preset?.params ? JSON.stringify(preset.params, null, 2) : '{}';
	}

	let tKey = $state('greeting.welcome');
	let tParamsJson = $state(paramsFor('greeting.welcome'));

	function pickPreset(key: string) {
		tKey = key;
		tParamsJson = paramsFor(key);
	}

	const tParsedParams = $derived.by(() => {
		try {
			const parsed = JSON.parse(tParamsJson);
			if (parsed && typeof parsed === 'object') {
				return parsed as Record<string, string | number>;
			}
		} catch {
			/* ignore */
		}
		return undefined;
	});
	const tResult = $derived(i18n.t(tKey, tParsedParams));

	// What placeholders does the current translation need?
	const tNeededPlaceholders = $derived.by(() => {
		const raw = i18n.t(tKey);
		if (raw === tKey) return []; // missing translation
		const out: string[] = [];
		const re = /\{(\w+)\}/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(raw)) !== null) {
			if (!out.includes(m[1])) out.push(m[1]);
		}
		return out;
	});

	// ── URL routing playground ──────────────────────────
	const routingCfg: LocaleRoutingConfig = {
		defaultLocale: 'en',
		supportedLocales: ['en', 'pl', 'de', 'uk'],
		prefixes: { uk: 'ua' }, // URL /ua/… — hreflang stays "uk"
	};
	let routePath = $state('/blog/yoga-for-beginners');
	const routeExtracted = $derived(extractLocale(routePath, routingCfg));
	const routeLinks = $derived(
		routingCfg.supportedLocales.map((locale) => ({
			locale,
			href: localizeHref(routeExtracted.pathname, locale, routingCfg),
		})),
	);
	const routeAlternates = $derived(
		alternates(routeExtracted.pathname, routingCfg, 'https://example.com'),
	);
	const headMarkup = $derived(
		routeAlternates
			.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
			.join('\n'),
	);

	const snippetCode =
		'<' +
		"script>\n" +
		"  import { LocaleSwitcher } from '@nomideusz/svelte-i18n';\n" +
		"  import { i18n } from '$lib/i18n';\n" +
		'</' +
		'script>\n\n' +
		"<LocaleSwitcher {i18n} labels={{ en: 'English', pl: 'Polski' }} />";
</script>

<svelte:head>
	<title>svelte-i18n — Demo</title>
</svelte:head>

<main>
	<section class="hero">
		<h1>{i18n.t('hero.title')}</h1>
		<p class="lead">{i18n.t('hero.subtitle')}</p>
		<div class="hero-actions">
			<div class="install">
				<code>{i18n.t('hero.install')}</code>
			</div>
			<LocaleSwitcher {i18n} labels={LOCALE_LABELS} />
		</div>
	</section>

	<!-- ═══ Live app preview ═══════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>Live preview</h2>
			<span class="hd-meta">
				current: <code>{i18n.locale}</code>
				{#if i18n.isLoading}<span class="loading">loading…</span>{/if}
			</span>
		</header>

		<div class="preview">
			<div class="preview-chrome">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="preview-url">myapp.com</span>
			</div>
			<div class="preview-body">
				<nav class="mock-nav">
					<strong>◈ MyApp</strong>
					<span class="mock-link">{i18n.t('nav.home')}</span>
					<span class="mock-link">{i18n.t('nav.pricing')}</span>
					<span class="mock-link">{i18n.t('nav.docs')}</span>
					<button class="mock-btn">{i18n.t('nav.signin')}</button>
				</nav>

				<div class="mock-welcome">
					{i18n.t('greeting.welcome', { name: 'Jan' })}
				</div>

				<div class="mock-cards">
					<div class="mock-card">
						<strong>{i18n.t('card.feature1.title')}</strong>
						<p>{i18n.t('card.feature1.body')}</p>
					</div>
					<div class="mock-card">
						<strong>{i18n.t('card.feature2.title')}</strong>
						<p>{i18n.t('card.feature2.body')}</p>
					</div>
					<div class="mock-card">
						<strong>{i18n.t('card.feature3.title')}</strong>
						<p>{i18n.t('card.feature3.body')}</p>
					</div>
				</div>

				<div class="mock-notif">
					{i18n.t('greeting.notifications', { count: 7 })}
				</div>

				<div class="mock-total">
					{i18n.t('billing.total', { amount: '129', currency: 'PLN' })}
				</div>
			</div>
		</div>

		<div class="switcher-row">
			<span class="switcher-label">Try it:</span>
			{#each i18n.supportedLocales as loc}
				<button
					class="locale-pill"
					class:locale-pill--active={i18n.locale === loc}
					onclick={() => i18n.setLocale(loc)}
					disabled={i18n.isLoading}
				>
					{LOCALE_LABELS[loc] ?? loc.toUpperCase()}
				</button>
			{/each}
		</div>
	</section>

	<!-- ═══ t() playground ═════════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>1. <code>i18n.t()</code></h2>
			<span class="hd-meta">lookup · interpolation · missing-key fallback</span>
		</header>

		<div class="row two-col">
			<div class="input-box">
				<label for="t-key">Key</label>
				<input id="t-key" type="text" bind:value={tKey} placeholder="greeting.welcome" />
			</div>
			<div class="input-box">
				<label for="t-params">Params (JSON)</label>
				<textarea id="t-params" bind:value={tParamsJson} rows="2"></textarea>
			</div>
		</div>

		<div class="presets">
			{#each T_PRESETS as p}
				<button class="preset" onclick={() => pickPreset(p.key)}>{p.key}</button>
			{/each}
		</div>

		<div class="output-grid">
			<div class="out out-wide">
				<span class="out-label">Result (current locale: <code>{i18n.locale}</code>)</span>
				<code class="out-val">{tResult}</code>
				{#if tResult === tKey}
					<span class="out-meta">⚠ key missing — <code>t()</code> returned the key itself</span>
				{/if}
			</div>
			<div class="out out-wide">
				<span class="out-label">Placeholders the translation needs</span>
				{#if tNeededPlaceholders.length === 0}
					<span class="empty">none</span>
				{:else}
					<div class="chips">
						{#each tNeededPlaceholders as p}
							{@const resolved = !!(tParsedParams && tParsedParams[p] !== undefined)}
							<span class="chip" class:chip-on={resolved}>
								{p}{resolved ? '' : ' · missing'}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- ═══ Interpolate playground ═════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>2. <code>interpolate()</code></h2>
			<span class="hd-meta">standalone {'{variable}'} substitution</span>
		</header>

		<div class="row two-col">
			<div class="input-box">
				<label for="i-tmpl">Template</label>
				<textarea id="i-tmpl" bind:value={template} rows="2"></textarea>
			</div>
			<div class="input-box">
				<label for="i-params">Params (JSON)</label>
				<textarea id="i-params" bind:value={paramsJson} rows="4" class:err={parseError}></textarea>
				{#if parseError}
					<span class="err-msg">Invalid JSON — falling back to no params</span>
				{/if}
			</div>
		</div>

		<div class="output-grid">
			<div class="out out-wide">
				<span class="out-label">Result</span>
				<code class="out-val">{interpolated || '—'}</code>
			</div>
			<div class="out">
				<span class="out-label">Placeholders detected</span>
				{#if placeholders.length === 0}
					<span class="empty">none</span>
				{:else}
					<div class="chips">
						{#each placeholders as p}
							{@const resolved = !!(parsedParams && parsedParams[p] !== undefined)}
							<span class="chip" class:chip-on={resolved}>{p}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- ═══ LocaleSwitcher demo ════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>3. <code>&lt;LocaleSwitcher /&gt;</code></h2>
			<span class="hd-meta">drop-in <code>&lt;select&gt;</code> — style via <code>--asini-*</code> CSS vars</span>
		</header>

		<div class="switcher-examples">
			<div class="switcher-ex">
				<span class="ex-label">With labels</span>
				<LocaleSwitcher {i18n} labels={LOCALE_LABELS} />
			</div>
			<div class="switcher-ex">
				<span class="ex-label">Without labels (code only)</span>
				<LocaleSwitcher {i18n} />
			</div>
		</div>

		<pre class="snippet">{snippetCode}</pre>
	</section>

	<!-- ═══ URL routing (SSR) ══════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>4. URL routing <span class="hd-meta">(SSR)</span></h2>
			<span class="hd-meta">path-prefix locales — default <code>en</code> bare; <code>uk</code> aliased to <code>/ua</code> (hreflang stays <code>uk</code>)</span>
		</header>

		<div class="row">
			<div class="input-box">
				<label for="r-path">Pathname (type a prefix like <code>/pl/…</code> or leave bare)</label>
				<input id="r-path" type="text" bind:value={routePath} spellcheck="false" />
			</div>
		</div>

		<div class="output-grid">
			<div class="out">
				<span class="out-label">extractLocale → locale</span>
				<code class="out-val">{routeExtracted.locale}</code>
			</div>
			<div class="out">
				<span class="out-label">extractLocale → pathname</span>
				<code class="out-val">{routeExtracted.pathname}</code>
			</div>
		</div>

		<div class="out out-wide">
			<span class="out-label">localizeHref per locale</span>
			<div class="chips">
				{#each routeLinks as link}
					<span class="chip" class:chip-on={link.locale === routeExtracted.locale}>
						{link.locale}: <code>{link.href}</code>
					</span>
				{/each}
			</div>
		</div>

		<div class="out out-wide">
			<span class="out-label">alternates() → <code>&lt;svelte:head&gt;</code> markup</span>
			<pre class="snippet">{headMarkup}</pre>
		</div>
	</section>

	<section class="cta">
		<p>Read the <a href="/docs">full docs</a> for the complete API.</p>
	</section>
</main>

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 24px 24px 80px;
	}
	@media (max-width: 600px) {
		main {
			padding: 16px 16px 48px;
		}
	}

	.hero {
		text-align: center;
		padding: 32px 0 40px;
	}
	.hero h1 {
		font: 700 34px/1.15 'Outfit', system-ui, sans-serif;
		margin: 0 0 14px;
		letter-spacing: -0.02em;
		color: var(--text);
	}
	.hero .lead {
		font: 400 15px/1.6 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
		max-width: 640px;
		margin: 0 auto 24px;
	}
	.hero-actions {
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
	}
	.install {
		padding: 10px 18px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
	}
	.install code {
		font-family: ui-monospace, 'Cascadia Code', monospace;
		font-size: 13px;
		color: var(--text);
	}
	@media (max-width: 600px) {
		.hero {
			padding: 16px 0 24px;
		}
		.hero h1 {
			font-size: 24px;
		}
		.hero .lead {
			font-size: 13.5px;
		}
	}

	/* ─── Card ─────────────────────────────────────────── */
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 20px;
	}
	.card-hd {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 14px;
		margin-bottom: 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--border);
	}
	.card-hd h2 {
		font: 600 16px/1.3 'Outfit', system-ui, sans-serif;
		margin: 0;
		color: var(--text);
	}
	.card-hd h2 code {
		font: 500 15px/1.3 ui-monospace, 'Cascadia Code', monospace;
		color: var(--accent);
		background: none;
		padding: 0;
	}
	.hd-meta {
		font: 400 11px/1.3 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}
	.hd-meta code {
		font: 500 11px/1.3 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-2);
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 3px;
	}
	.loading {
		color: var(--accent);
		margin-left: 6px;
		font-style: italic;
	}

	/* ─── Preview ──────────────────────────────────────── */
	.preview {
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.preview-chrome {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--border-strong);
	}
	.preview-url {
		margin-left: 10px;
		font: 500 11px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}
	.preview-body {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.mock-nav {
		display: flex;
		align-items: center;
		gap: 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
	}
	.mock-nav strong {
		color: var(--accent);
		margin-right: auto;
	}
	.mock-link {
		color: var(--text-2);
		font: 500 12px/1 'Outfit', system-ui, sans-serif;
	}
	.mock-btn {
		padding: 5px 12px;
		border: 1px solid var(--accent);
		background: var(--accent-dim);
		color: var(--accent);
		border-radius: 5px;
		font: 500 11.5px/1 'Outfit', system-ui, sans-serif;
		cursor: pointer;
	}
	.mock-welcome {
		font: 600 18px/1.3 'Outfit', system-ui, sans-serif;
		color: var(--text);
	}
	.mock-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 10px;
	}
	.mock-card {
		padding: 12px 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 7px;
	}
	.mock-card strong {
		display: block;
		font: 600 12.5px/1.3 'Outfit', system-ui, sans-serif;
		color: var(--text);
		margin-bottom: 5px;
	}
	.mock-card p {
		font: 400 12px/1.4 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
		margin: 0;
	}
	.mock-notif {
		padding: 10px 14px;
		background: var(--accent-dim);
		border: 1px solid var(--accent-glow);
		border-radius: 7px;
		font: 500 13px/1.3 'Outfit', system-ui, sans-serif;
		color: var(--accent);
	}
	.mock-total {
		font: 600 15px/1.3 'Outfit', system-ui, sans-serif;
		color: var(--text);
		text-align: right;
	}

	.switcher-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 16px;
	}
	.switcher-label {
		font: 500 12px/1 'Outfit', system-ui, sans-serif;
		color: var(--text-3);
		margin-right: 4px;
	}
	.locale-pill {
		padding: 6px 12px;
		border: 1px solid var(--border-strong);
		background: transparent;
		color: var(--text-2);
		border-radius: 6px;
		font: 500 12px/1 'Outfit', system-ui, sans-serif;
		cursor: pointer;
		transition: all 120ms;
	}
	.locale-pill:hover {
		color: var(--text);
		border-color: var(--accent);
	}
	.locale-pill:disabled {
		opacity: 0.5;
		cursor: wait;
	}
	.locale-pill--active {
		background: var(--accent-dim);
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ─── Inputs ───────────────────────────────────────── */
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 14px;
		margin-bottom: 14px;
	}
	.row.two-col .input-box {
		flex: 1;
		min-width: 200px;
	}
	.input-box {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.input-box label {
		font: 600 10px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.input-box input,
	.input-box textarea {
		padding: 8px 11px;
		border: 1px solid var(--border-strong);
		background: var(--surface-2);
		color: var(--text);
		border-radius: 6px;
		font: 400 13px/1.4 ui-monospace, 'Cascadia Code', monospace;
		outline: none;
		transition: border-color 120ms, background 120ms;
		resize: vertical;
	}
	.input-box input:focus,
	.input-box textarea:focus {
		border-color: var(--accent);
		background: var(--bg);
	}
	.input-box textarea.err {
		border-color: #ef4444;
	}
	.err-msg {
		font: 400 11px/1.2 'Outfit', system-ui, sans-serif;
		color: #ef4444;
	}

	/* ─── Output ───────────────────────────────────────── */
	.output-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 10px;
	}
	.out {
		padding: 10px 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 7px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 56px;
	}
	.out-wide {
		grid-column: 1 / -1;
	}
	.out-label {
		font: 600 10px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.out-label code {
		font: 600 10px/1 ui-monospace, 'Cascadia Code', monospace;
		background: none;
		padding: 0;
		color: var(--text-2);
		text-transform: none;
	}
	.out-val {
		font: 500 13px/1.4 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text);
		word-break: break-word;
		white-space: pre-wrap;
	}
	.out-meta {
		font: 400 11px/1.2 'Outfit', system-ui, sans-serif;
		color: #fbbf24;
	}
	.out-meta code {
		font: 500 11px/1 ui-monospace, 'Cascadia Code', monospace;
		background: none;
		padding: 0;
		color: inherit;
	}
	.empty {
		font: 400 12px/1 'Outfit', system-ui, sans-serif;
		color: var(--text-3);
		font-style: italic;
	}

	/* ─── Chips ────────────────────────────────────────── */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chip {
		padding: 3px 8px;
		border-radius: 4px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		font: 500 11px/1.2 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}
	.chip-on {
		background: var(--accent-dim);
		border-color: var(--accent-glow);
		color: var(--accent);
	}

	/* ─── Presets ──────────────────────────────────────── */
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 14px;
	}
	.preset {
		padding: 5px 10px;
		background: transparent;
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		font: 500 11px/1.2 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-2);
		cursor: pointer;
		transition: color 120ms, border-color 120ms, background 120ms;
	}
	.preset:hover {
		color: var(--text);
		border-color: var(--accent);
		background: var(--accent-dim);
	}

	/* ─── Switcher examples ────────────────────────────── */
	.switcher-examples {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}
	.switcher-ex {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ex-label {
		font: 600 10px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.snippet {
		margin: 0;
		padding: 12px 14px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 7px;
		font: 400 12px/1.55 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-2);
		overflow-x: auto;
	}

	/* ─── CTA ──────────────────────────────────────────── */
	.cta {
		text-align: center;
		padding: 24px 0 0;
		font: 400 14px/1.5 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
	}
	.cta a {
		color: var(--accent);
		border-bottom: 1px solid var(--accent-glow);
	}
	.cta a:hover {
		border-bottom-color: var(--accent);
	}
</style>
