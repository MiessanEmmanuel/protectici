import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_THEME_COOKIE, parseAdminTheme } from '@/lib/admin-theme';

export const metadata: Metadata = {
  title: { default: 'Administration', template: '%s | Administration | ProtectIci' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Préférence d'affichage lue côté serveur : le thème est posé dès le premier rendu.
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);
  return <AdminShell initialTheme={theme}>{children}</AdminShell>;
}
