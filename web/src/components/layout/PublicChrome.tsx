'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** La zone /admin a sa propre coquille (barre latérale, barre du haut) : pas d'en-tête ni de pied public. */
export function isAdminPath(pathname: string | null): boolean {
  return pathname === '/admin' || (pathname?.startsWith('/admin/') ?? false);
}

/** Affiche l'habillage public (en-tête, flash info, pied de page, barre mobile) hors de /admin. */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isAdminPath(pathname) ? null : <>{children}</>;
}
