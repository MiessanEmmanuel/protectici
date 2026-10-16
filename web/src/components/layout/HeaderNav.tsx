'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../ui/cn';
import { isActive, NAV_LINKS } from './nav-links';
import { useSession } from './SessionProvider';

const deskLink =
  'inline-flex h-header items-center gap-2 px-4 text-[0.95rem] font-bold text-inherit no-underline hover:bg-c3 hover:text-on-c3 aria-[current=page]:bg-c3 aria-[current=page]:text-on-c3 [&_svg]:size-[1.15em]';
const mobileLink =
  'flex min-h-14 items-center gap-3 border-t-2 border-white/15 px-4 font-extrabold text-inherit no-underline hover:bg-c2 hover:text-on-c2 aria-[current=page]:bg-c1 [&_svg]:size-[1.15em]';

interface AccountLink {
  href: string;
  label: string;
}

function accountLinks(role: string | undefined): AccountLink[] {
  const links: AccountLink[] = [];
  if (role === 'admin') links.push({ href: '/admin', label: 'Administration' });
  if (role === 'editor') links.push({ href: '/admin/blog', label: 'Gestion du blog' });
  if (role === 'provider') links.push({ href: '/espace-prestataire', label: 'Mes établissements' });
  links.push({ href: '/compte', label: 'Mon compte' });
  return links;
}

/**
 * Navigation de l'en-tête. ≥ 1280 px : liens à icônes + compte. En dessous : bouton « Menu »
 * (aria-expanded / aria-controls) ouvrant un panneau nuit. Le panneau se referme au changement de
 * page et avec Échap. Sans JavaScript, la navigation reste accessible via le pied de page.
 */
export function HeaderNav({ logo }: { logo: ReactNode }) {
  const pathname = usePathname();
  // Les menus se referment tout seuls à chaque changement de page (l'état est lié au chemin).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [accountFor, setAccountFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const accountOpen = accountFor === pathname;
  const { user, status, logout } = useSession();
  const burgerRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !accountOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (open) {
        setOpenFor(null);
        burgerRef.current?.focus();
      }
      setAccountFor(null);
    }
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountFor(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, accountOpen]);

  const authed = status === 'authenticated' && !!user;
  const links = authed ? accountLinks(user.role) : [];

  return (
    <>
      <div className="wrap flex min-h-header items-center gap-7">
        {logo}
        <nav aria-label="Navigation principale" className="ml-auto hidden xl:flex">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={deskLink}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden xl:block">
          {authed ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-controls="menu-compte"
                onClick={() => setAccountFor(accountOpen ? null : pathname)}
                className="inline-flex min-h-tap items-center gap-2 font-bold underline underline-offset-[0.2em] [&_svg]:size-[1.15em]"
              >
                <UserRound aria-hidden="true" />
                Mon compte
                <ChevronDown aria-hidden="true" />
              </button>
              <ul
                id="menu-compte"
                hidden={!accountOpen}
                className="absolute top-full right-0 z-50 mt-3 min-w-56 border-2 border-white bg-c3 text-on-c3"
              >
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={mobileLink}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className={cn(mobileLink, 'w-full text-left')}
                  >
                    <LogOut aria-hidden="true" />
                    Déconnexion
                  </button>
                </li>
              </ul>
            </div>
          ) : status === 'loading' ? (
            <span className="inline-block min-h-tap w-32" aria-hidden="true" />
          ) : (
            <Link
              href="/connexion"
              className="inline-flex min-h-tap items-center gap-2 font-bold text-inherit underline underline-offset-[0.2em] [&_svg]:size-[1.15em]"
            >
              <UserRound aria-hidden="true" />
              Se connecter
            </Link>
          )}
        </div>

        <button
          ref={burgerRef}
          type="button"
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpenFor(open ? null : pathname)}
          className="ml-auto inline-flex min-h-12 min-w-12 items-center gap-2 border-2 border-current px-3 text-[0.85rem] font-extrabold xl:hidden [&_svg]:size-[1.15em]"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          {open ? 'Fermer' : 'Menu'}
        </button>
      </div>

      <nav
        id="menu-mobile"
        aria-label="Menu mobile"
        hidden={!open}
        className="bg-c3 text-on-c3 xl:hidden"
      >
        <ul>
          {NAV_LINKS.map(({ href, label, longLabel, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={mobileLink}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                {longLabel ?? label}
              </Link>
            </li>
          ))}
          {authed ? (
            <>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={mobileLink}>
                    {l.href === '/compte' ? <UserRound aria-hidden="true" /> : null}
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className={cn(mobileLink, 'w-full text-left')}
                >
                  <LogOut aria-hidden="true" />
                  Déconnexion
                </button>
              </li>
            </>
          ) : status === 'loading' ? null : (
            <>
              <li>
                <Link href="/connexion" className={mobileLink}>
                  <UserRound aria-hidden="true" />
                  Se connecter
                </Link>
              </li>
              <li>
                <Link href="/inscription" className={mobileLink}>
                  Créer un compte
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </>
  );
}
