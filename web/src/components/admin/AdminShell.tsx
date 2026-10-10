'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { AdminAccessGate } from './AdminAccessGate';
import { NotificationBell } from './NotificationBell';

export const ADMIN_NAV = [
  { href: '/admin', label: 'Tableau de bord', exact: true },
  { href: '/admin/etablissements', label: 'Établissements' },
  { href: '/admin/modifications', label: 'Demandes de modification' },
  { href: '/admin/avis', label: 'Avis et signalements' },
  { href: '/admin/dis-moi-tout', label: 'Dis-moi tout' },
  { href: '/admin/devis', label: 'Devis' },
  { href: '/admin/messages', label: 'Messages de contact' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/referentiels', label: 'Référentiels' },
  { href: '/admin/journal', label: 'Journal d’audit' },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Cadre de la zone d'administration : garde d'accès, navigation latérale repliable, cloche. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Le menu mobile se referme à chaque changement de page (état lié au chemin).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  return (
    <AdminAccessGate>
      <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="flex items-center justify-between gap-3 lg:block">
            <p className="text-lg font-bold">Administration</p>
            <Button
              variant="secondary"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="menu-admin"
              onClick={() => setOpenFor(open ? null : pathname)}
            >
              {open ? 'Fermer le menu' : 'Menu d’administration'}
            </Button>
          </div>
          <nav
            id="menu-admin"
            aria-label="Administration"
            className={cn('mt-3 lg:block', open ? 'block' : 'hidden')}
          >
            <ul className="flex flex-col gap-1">
              {ADMIN_NAV.map((l) => {
                const active = isActive(pathname, l.href, 'exact' in l ? l.exact : false);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-tap items-center rounded-md px-3 no-underline',
                        active
                          ? 'bg-primary font-semibold text-on-primary'
                          : 'text-ink hover:bg-primary-soft',
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex justify-end">
            <NotificationBell />
          </div>
          {children}
        </div>
      </div>
    </AdminAccessGate>
  );
}
