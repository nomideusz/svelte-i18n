// SvelteKit server hook for URL-locale routing. Structurally typed like
// createReroute so the package has no runtime dependency on @sveltejs/kit;
// assign the result to kit's `Handle` in the app.
import { localizeHref, negotiateLocale, resolveLocale, type LocaleRoutingConfig } from './routing.js';
import type { Locale } from './types.js';

export interface LocaleHandleOptions {
  /**
   * Path prefixes served WITHOUT a locale prefix (an app/admin area, auth
   * pages). There the locale is a preference: cookie, else Accept-Language.
   * The preference cookie is never written from these paths — the public,
   * prefixed URL is the source of truth.
   */
  unprefixed?: string[];
}

const COOKIE = 'locale';
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
 * not the default (cookie preference, else Accept-Language); resolve the
 * request locale from the URL prefix; set `event.locals.locale`; keep the
 * `locale` cookie in sync; and replace `%lang%` in app.html with the locale.
 *
 * Cookie-less visitors on the default locale (most humans and every crawler)
 * get NO Set-Cookie, so their responses stay cacheable at the CDN.
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
    const cookieLocale = event.cookies.get(COOKIE);
    const { pathname } = event.url;
    const isApp = unprefixed.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (pathname === '/') {
      const target = cookieLocale || negotiateLocale(acceptLanguage, config);
      if (target !== config.defaultLocale && isSupported(target)) {
        return new Response(null, {
          status: 302,
          headers: {
            location: localizeHref('/', target, config),
            vary: 'accept-language, cookie',
          },
        });
      }
    }

    let locale: Locale;
    if (isApp) {
      locale = isSupported(cookieLocale) ? cookieLocale : negotiateLocale(acceptLanguage, config);
    } else {
      locale = resolveLocale({ pathname, acceptLanguage }, config);
      // Bare-root renders here only for default-locale visitors (others were
      // redirected above). resolveLocale negotiates at '/', which would
      // override a stored default-locale preference — honor the cookie.
      if (pathname === '/' && isSupported(cookieLocale)) locale = cookieLocale;
    }
    (event.locals as { locale?: string }).locale = locale;

    if (!isApp && (cookieLocale ? cookieLocale !== locale : locale !== config.defaultLocale)) {
      event.cookies.set(COOKIE, locale, {
        path: '/',
        maxAge: YEAR,
        httpOnly: false, // the client-side switcher may update it
        sameSite: 'lax',
        secure: event.url.protocol === 'https:',
      });
    }

    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%lang%', locale),
    });
  };
}
