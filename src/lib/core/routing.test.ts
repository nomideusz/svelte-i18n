import { describe, it, expect } from 'vitest';
import {
  extractLocale,
  localizeHref,
  alternates,
  negotiateLocale,
  resolveLocale,
  createReroute,
  type LocaleRoutingConfig,
} from './routing.js';

const cfg: LocaleRoutingConfig = {
  defaultLocale: 'pl',
  supportedLocales: ['pl', 'en', 'uk'],
};

describe('extractLocale', () => {
  it('extracts a non-default prefix', () => {
    expect(extractLocale('/en/krakow', cfg)).toEqual({ locale: 'en', pathname: '/krakow' });
    expect(extractLocale('/uk/krakow/studio', cfg)).toEqual({ locale: 'uk', pathname: '/krakow/studio' });
  });

  it('treats un-prefixed paths as the default locale', () => {
    expect(extractLocale('/krakow', cfg)).toEqual({ locale: 'pl', pathname: '/krakow' });
  });

  it('maps a bare locale prefix to root', () => {
    expect(extractLocale('/en', cfg)).toEqual({ locale: 'en', pathname: '/' });
  });

  it('maps the site root to the default locale', () => {
    expect(extractLocale('/', cfg)).toEqual({ locale: 'pl', pathname: '/' });
  });

  it('does NOT treat the default locale as a prefix (no /pl duplicate)', () => {
    expect(extractLocale('/pl/krakow', cfg)).toEqual({ locale: 'pl', pathname: '/pl/krakow' });
  });

  it('preserves trailing slashes', () => {
    expect(extractLocale('/en/krakow/', cfg)).toEqual({ locale: 'en', pathname: '/krakow/' });
  });

  it('does not match a locale that is only a substring of a segment', () => {
    expect(extractLocale('/english-classes', cfg)).toEqual({ locale: 'pl', pathname: '/english-classes' });
  });
});

describe('localizeHref', () => {
  it('prefixes non-default locales', () => {
    expect(localizeHref('/krakow', 'en', cfg)).toBe('/en/krakow');
    expect(localizeHref('/krakow', 'uk', cfg)).toBe('/uk/krakow');
  });

  it('leaves the default locale un-prefixed', () => {
    expect(localizeHref('/krakow', 'pl', cfg)).toBe('/krakow');
  });

  it('handles root', () => {
    expect(localizeHref('/', 'en', cfg)).toBe('/en');
    expect(localizeHref('/', 'pl', cfg)).toBe('/');
  });

  it('preserves query strings and hashes', () => {
    expect(localizeHref('/krakow?style=hatha', 'en', cfg)).toBe('/en/krakow?style=hatha');
    expect(localizeHref('/krakow#map', 'uk', cfg)).toBe('/uk/krakow#map');
  });

  it('ignores external and non-path hrefs', () => {
    expect(localizeHref('https://x.com', 'en', cfg)).toBe('https://x.com');
    expect(localizeHref('//cdn.x.com/a', 'en', cfg)).toBe('//cdn.x.com/a');
    expect(localizeHref('mailto:a@b.c', 'en', cfg)).toBe('mailto:a@b.c');
    expect(localizeHref('#section', 'en', cfg)).toBe('#section');
  });

  it('does not double-prefix an already-localized path', () => {
    expect(localizeHref('/en/krakow', 'en', cfg)).toBe('/en/krakow');
    expect(localizeHref('/en', 'en', cfg)).toBe('/en');
  });

  it('ignores unsupported locales', () => {
    expect(localizeHref('/krakow', 'de', cfg)).toBe('/krakow');
  });
});

describe('round-trip extract ∘ localize', () => {
  const paths = ['/', '/krakow', '/krakow/studio-x', '/category/hatha'];
  for (const locale of cfg.supportedLocales) {
    for (const path of paths) {
      it(`${locale} ${path}`, () => {
        const href = localizeHref(path, locale, cfg);
        const back = extractLocale(href, cfg);
        expect(back.locale).toBe(locale);
        expect(back.pathname).toBe(path);
      });
    }
  }
});

describe('alternates', () => {
  it('builds hreflang links for every locale plus x-default', () => {
    expect(alternates('/krakow', cfg, 'https://szkolyjogi.pl')).toEqual([
      { hreflang: 'pl', href: 'https://szkolyjogi.pl/krakow' },
      { hreflang: 'en', href: 'https://szkolyjogi.pl/en/krakow' },
      { hreflang: 'uk', href: 'https://szkolyjogi.pl/uk/krakow' },
      { hreflang: 'x-default', href: 'https://szkolyjogi.pl/krakow' },
    ]);
  });

  it('handles the home page', () => {
    expect(alternates('/', cfg, 'https://szkolyjogi.pl')).toEqual([
      { hreflang: 'pl', href: 'https://szkolyjogi.pl/' },
      { hreflang: 'en', href: 'https://szkolyjogi.pl/en' },
      { hreflang: 'uk', href: 'https://szkolyjogi.pl/uk' },
      { hreflang: 'x-default', href: 'https://szkolyjogi.pl/' },
    ]);
  });

  it('strips a trailing slash from the origin', () => {
    expect(alternates('/krakow', cfg, 'https://szkolyjogi.pl/')[0].href).toBe(
      'https://szkolyjogi.pl/krakow',
    );
  });
});

describe('negotiateLocale', () => {
  it('picks the highest-weighted supported locale', () => {
    expect(negotiateLocale('uk,en;q=0.8,pl;q=0.5', cfg)).toBe('uk');
    expect(negotiateLocale('en-US,en;q=0.9,pl;q=0.1', cfg)).toBe('en');
  });

  it('matches on the primary subtag', () => {
    expect(negotiateLocale('en-GB', cfg)).toBe('en');
    expect(negotiateLocale('uk-UA', cfg)).toBe('uk');
  });

  it('respects quality ordering over header order', () => {
    expect(negotiateLocale('en;q=0.3,uk;q=0.9', cfg)).toBe('uk');
  });

  it('falls back to default when nothing matches', () => {
    expect(negotiateLocale('fr-FR,fr;q=0.9,de;q=0.8', cfg)).toBe('pl');
  });

  it('falls back to default for empty/absent header', () => {
    expect(negotiateLocale(null, cfg)).toBe('pl');
    expect(negotiateLocale('', cfg)).toBe('pl');
  });

  it('ignores q=0 entries', () => {
    expect(negotiateLocale('en;q=0,uk;q=0.4', cfg)).toBe('uk');
  });
});

describe('resolveLocale', () => {
  it('trusts a URL prefix over the header', () => {
    expect(resolveLocale({ pathname: '/en/krakow', acceptLanguage: 'uk' }, cfg)).toBe('en');
  });

  it('negotiates at the bare root', () => {
    expect(resolveLocale({ pathname: '/', acceptLanguage: 'uk,en;q=0.8' }, cfg)).toBe('uk');
  });

  it('keeps deep un-prefixed paths on the default locale (crawler-stable)', () => {
    expect(resolveLocale({ pathname: '/krakow', acceptLanguage: 'uk' }, cfg)).toBe('pl');
  });

  it('defaults the bare root with no header', () => {
    expect(resolveLocale({ pathname: '/' }, cfg)).toBe('pl');
  });
});

describe('createReroute', () => {
  const reroute = createReroute(cfg);

  it('strips the locale prefix to hit the real route', () => {
    expect(reroute({ url: new URL('https://x.pl/en/krakow') })).toBe('/krakow');
    expect(reroute({ url: new URL('https://x.pl/uk') })).toBe('/');
  });

  it('leaves un-prefixed paths unchanged', () => {
    expect(reroute({ url: new URL('https://x.pl/krakow') })).toBe('/krakow');
  });
});
