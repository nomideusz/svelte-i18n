import { describe, it, expect } from 'vitest';
import { createLocaleHandle } from './hooks.js';
import type { LocaleRoutingConfig } from './routing.js';

const cfg: LocaleRoutingConfig = { defaultLocale: 'pl', supportedLocales: ['pl', 'en'] };

function run(
  handle: ReturnType<typeof createLocaleHandle>,
  path: string,
  { cookie, accept }: { cookie?: string; accept?: string } = {},
) {
  const set: unknown[] = [];
  const locals: { locale?: string } = {};
  const event = {
    url: new URL(`https://x.test${path}`),
    request: { headers: { get: (n: string) => (n === 'accept-language' ? (accept ?? null) : null) } },
    cookies: { get: (n: string) => (n === 'locale' ? cookie : undefined), set: (...a: unknown[]) => set.push(a) },
    locals,
  };
  const resolve = (_e: typeof event, o?: { transformPageChunk?: (i: { html: string; done: boolean }) => string | undefined }) =>
    new Response(o?.transformPageChunk?.({ html: '<html lang="%lang%">', done: true }));
  return handle({ event, resolve }).then((res) => ({ res, set, locals }));
}

describe('createLocaleHandle', () => {
  const handle = createLocaleHandle(cfg, { unprefixed: ['/admin'] });

  it('redirects a bare-root foreign visitor to their prefixed home', async () => {
    const { res } = await run(handle, '/', { accept: 'en-US,en;q=0.9' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/en');
  });

  it('cookie-less default-locale visitor: no Set-Cookie (cacheable), lang filled', async () => {
    const { res, set, locals } = await run(handle, '/krakow');
    expect(set).toEqual([]);
    expect(locals.locale).toBe('pl');
    expect(await res.text()).toBe('<html lang="pl">');
  });

  it('prefixed URL is the source of truth and syncs the cookie', async () => {
    const { set, locals } = await run(handle, '/en/krakow', { cookie: 'pl' });
    expect(locals.locale).toBe('en');
    expect((set[0] as unknown[]).slice(0, 2)).toEqual(['locale', 'en']);
  });

  it('unprefixed area follows the cookie and never writes it', async () => {
    const { set, locals } = await run(handle, '/admin/x', { cookie: 'en', accept: 'pl' });
    expect(locals.locale).toBe('en');
    expect(set).toEqual([]);
  });

  it('bare root honors a stored default-locale preference over Accept-Language', async () => {
    const { res, locals } = await run(handle, '/', { cookie: 'pl', accept: 'en' });
    expect(res.status).toBe(200);
    expect(locals.locale).toBe('pl');
  });
});
