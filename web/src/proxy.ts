import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * Proxy Next.js (ex-middleware) :
 *  1. CSP stricte à nonce + en-têtes de sécurité dynamiques ;
 *  2. confort UX : redirige vers /connexion si aucun cookie de session pour /admin et /compte.
 * Ce contrôle n'est PAS une autorisation : l'API Laravel refait toujours la vérification.
 */

const PROTECTED = ['/admin', '/compte'];

function apiOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').origin;
  } catch {
    return "'self'";
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === '1';
    const cookieName = useMocks
      ? 'mock_state'
      : process.env.SESSION_COOKIE_NAME || 'protectici_session';
    if (!request.cookies.has(cookieName)) {
      const url = request.nextUrl.clone();
      url.pathname = '/connexion';
      url.search = '';
      url.searchParams.set('redirect', safeRedirect(pathname + search, '/compte'));
      return NextResponse.redirect(url);
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production',
    apiOrigin: apiOrigin(),
    mediaOrigins: process.env.NEXT_PUBLIC_MEDIA_ORIGINS,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/compte') ||
    pathname.startsWith('/connexion')
  ) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|logo-protectici.webp|map/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
