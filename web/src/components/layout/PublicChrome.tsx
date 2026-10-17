'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** La zone /admin a sa propre coquille (barre latérale, barre du haut) : pas d'en-tête ni de pied public. */
export function isAdminPath(pathname: string | null): boolean {
  return pathname === '/admin' || (pathname?.startsWith('/admin/') ?? false);
}

/** Pages de compte en plein écran (gabarit AuthShell, avec son propre logo) : pas d'habillage public. */
const AUTH_PATHS = ['/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe'];

export function isAuthPath(pathname: string | null): boolean {
  return AUTH_PATHS.some((p) => pathname === p || (pathname?.startsWith(`${p}/`) ?? false));
}

/** Affiche l'habillage public (en-tête, flash info, pied de page, barre mobile) hors de /admin et des pages de compte. */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isAdminPath(pathname) || isAuthPath(pathname) ? null : <>{children}</>;
}
