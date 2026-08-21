// SvelteKit server hook for URL-locale routing. Structurally typed like
// createReroute so the package has no runtime dependency on @sveltejs/kit;
// assign the result to kit's `Handle` in the app.
import { extractLocale, localizeHref, negotiateLocale, type LocaleRoutingConfig } from './routing.js';
import type { Locale } from './types.js';

export interface LocaleHandleOptions {
  /**
   * Path prefixes served WITHOUT a locale prefix (an app/admin area, auth
   * pages). There the locale is a preference: cookie, else Accept-Language,
   * instead of the default locale a public un-prefixed path would get.
   *
   * The preference cookie is never written from any un-prefixed path — only a
   * URL that carries a prefix (or the bare root) decides a locale.
   */
  unprefixed?: string[];
}

/** The preference cookie this handle reads and writes. `LocaleSwitcher` writes the same one. */
export const LOCALE_COOKIE = 'locale';
const YEAR = 60 * 60 * 24 * 365;

interface HandleEvent {
  url: URL;
  request: { headers: { get(name: string): string | null } };
  cookies: {
    get(name: string): string | undefined;
    set(
      name: string,
      value: string,
      opts: { path: string; maxAge?: number; httpOnly?: boolean; sameSite?: 'lax'; secure?: boolean },
    ): void;
  };
  locals: object;
}

interface HandleInput<E extends HandleEvent> {
  event: E;
  resolve(
    event: E,
    opts?: { transformPageChunk?: (input: { html: string; done: boolean }) => string | undefined },
  ): Response | Promise<Response>;
}

/**
 * Per request: redirect a bare-root visitor to their locale's home when it is
 * not the default (cookie preference, else Accept-Language, query preserved);
 * resolve the request locale from the URL prefix; set `event.locals.locale`;
 * keep the `locale` cookie in sync; and replace `%lang%` in app.html with the
 * locale.
 *
 * Cookie-less visitors on the default locale (most humans and every crawler)
 * get NO Set-Cookie, so their responses stay cacheable at the CDN. The bare
 * root is served with `Vary: accept-language, cookie`, since it is the one
 * path whose response depends on who is asking.
 *
 * @example
 * // src/hooks.server.ts
 * const localeHandle: Handle = createLocaleHandle(i18nRouting, { unprefixed: ['/admin'] });
 * export const handle = sequence(localeHandle, ...);
 */
export function createLocaleHandle(config: LocaleRoutingConfig, options: LocaleHandleOptions = {}) {
  const unprefixed = options.unprefixed ?? [];
  const isSupported = (l: string | undefined): l is Locale =>
    !!l && config.supportedLocales.includes(l);

  return async <E extends HandleEvent>({ event, resolve }: HandleInput<E>): Promise<Response> => {
    const acceptLanguage = event.request.headers.get('accept-language');
    const cookieLocale = event.cookies.get(LOCALE_COOKIE);
    // A cookie naming a locale the app no longer serves is not a preference.
    // Ignoring it matters at the bare root: left in, it suppresses the redirect
    // and the canonical '/' serves whatever Accept-Language negotiated.
    const preferred = isSupported(cookieLocale) ? cookieLocale : undefined;
    const { pathname, search } = event.url;
    const isApp = unprefixed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    // The URL is the source of truth only where it actually carries a prefix.
    const urlLocale = extractLocale(pathname, config).locale;
    const prefixed = urlLocale !== config.defaultLocale;

    if (pathname === '/') {
      const target = preferred ?? negotiateLocale(acceptLanguage, config);
      if (target !== config.defaultLocale) {
        return new Response(null, {
          status: 302,
          headers: {
            // Keep the query: '/' is where ad traffic lands, and utm/gclid
            // must survive the locale hop.
            location: localizeHref('/', target, config) + search,
            vary: 'accept-language, cookie',
          },
        });
      }
    }

    let locale: Locale;
    if (isApp || !prefixed) {
      // No prefix to trust: the locale is a preference (cookie, else the
      // browser's), and un-prefixed public paths stay on the default so deep
      // canonical URLs remain stable for crawlers.
      locale =
        isApp || pathname === '/'
          ? (preferred ?? negotiateLocale(acceptLanguage, config))
          : config.defaultLocale;
    } else {
      locale = urlLocale;
    }
    (event.locals as { locale?: string }).locale = locale;

    // Write only where the URL decided the locale — a prefixed path, or the
    // bare root. On un-prefixed paths the default locale is an assumption, not
    // a choice, and writing it there erases a preference the visitor made.
    const urlDecided = !isApp && (prefixed || pathname === '/');
    if (urlDecided && (cookieLocale ? cookieLocale !== locale : locale !== config.defaultLocale)) {
      event.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: YEAR,
        httpOnly: false, // the client-side switcher may update it
        sameSite: 'lax',
        secure: event.url.protocol === 'https:',
      });
    }

    const response = await resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%lang%', locale),
    });
    // The bare root is the one path whose response depends on the visitor:
    // without this a CDN could hand a cached default-locale '/' to someone the
    // redirect above was meant to send elsewhere.
    if (pathname === '/') response.headers.append('vary', 'accept-language, cookie');
    return response;
  };
}
