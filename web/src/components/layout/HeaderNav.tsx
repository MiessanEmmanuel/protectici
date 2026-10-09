'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '../ui/cn';
import { buttonClasses } from '../ui/Button';
import { useSession } from './SessionProvider';

const links = [
  { href: '/', label: 'Accueil' },
  { href: '/annuaire', label: 'Prestataires' },
  { href: '/forces-etatiques', label: 'Forces étatiques' },
  { href: '/devis', label: 'Demande de devis' },
  { href: '/dis-moi-tout', label: 'Dis-moi tout' },
  { href: '/contact', label: 'Contact' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname();
  // Le menu mobile se referme tout seul à chaque changement de page (l'état est lié au chemin).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const { user, status, logout } = useSession();

  const link = 'inline-flex min-h-tap items-center px-3 no-underline hover:underline';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={buttonClasses('secondary', 'md', 'lg:hidden')}
        aria-expanded={open}
        aria-controls="menu-principal"
        onClick={() => setOpenFor(open ? null : pathname)}
      >
        {open ? 'Fermer' : 'Menu'}
      </button>
      <nav
        id="menu-principal"
        aria-label="Navigation principale"
        className={cn(
          'absolute inset-x-0 top-[4.25rem] z-40 border-b border-line bg-surface px-4 py-3 shadow-card lg:static lg:block lg:border-0 lg:p-0 lg:shadow-none',
          open ? 'block' : 'hidden',
        )}
      >
        <ul className="flex flex-col lg:flex-row lg:items-center lg:gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cn(
                  link,
                  isActive(pathname, l.href)
                    ? 'font-semibold text-primary-active underline'
                    : 'text-ink',
                )}
                aria-current={isActive(pathname, l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li className="mt-2 flex flex-col gap-2 lg:mt-0 lg:ml-2 lg:flex-row lg:items-center">
            {status === 'authenticated' && user ? (
              <>
                {user.role === 'admin' ? (
                  <Link href="/admin" className={link}>
                    Administration
                  </Link>
                ) : null}
                {user.role === 'provider' ? (
                  <Link href="/espace-prestataire" className={link}>
                    Mes établissements
                  </Link>
                ) : null}
                <Link href="/compte" className={buttonClasses('secondary')}>
                  Mon compte
                </Link>
                <button
                  type="button"
                  className={buttonClasses('ghost')}
                  onClick={() => void logout()}
                >
                  Déconnexion
                </button>
              </>
            ) : status === 'loading' ? (
              <span className="inline-block min-h-tap w-28" aria-hidden="true" />
            ) : (
              <>
                <Link href="/connexion" className={buttonClasses('secondary')}>
                  Se connecter
                </Link>
                <Link href="/inscription" className={buttonClasses('primary')}>
                  Créer un compte
                </Link>
              </>
            )}
          </li>
        </ul>
      </nav>
    </div>
  );
}
