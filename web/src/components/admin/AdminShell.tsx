'use client';

import {
  BadgeCheck,
  Building2,
  Check,
  ExternalLink,
  FilePen,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTree,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessagesSquare,
  Newspaper,
  ScrollText,
  Send,
  Settings,
  Star,
  Tags,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { adminHomeFor, adminNavFor, type AdminNavItem } from '@/lib/admin-access';
import { persistAdminTheme, type AdminTheme } from '@/lib/admin-theme';
import { useSession } from '../layout/SessionProvider';
import { cn } from '../ui/cn';
import { AdminAccessGate } from './AdminAccessGate';
import { AdminThemeToggle } from './AdminThemeToggle';
import { NotificationBell } from './NotificationBell';
import { navCounts, totalTodo, useAdminCounts } from './admin-counts';

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Entrée active : la plus précise (ex. « Import Excel » plutôt que « Établissements » sur /admin/etablissements/import). */
function activeHref(pathname: string, items: AdminNavItem[]): string | null {
  let best: AdminNavItem | null = null;
  for (const i of items) {
    if (isActive(pathname, i.href, i.exact) && (!best || i.href.length > best.href.length)) best = i;
  }
  return best?.href ?? null;
}

/** Icône et rubrique de chaque entrée (présentation seulement : la liste vient de adminNavFor). */
const NAV_META: Record<string, { icon: LucideIcon; group: string }> = {
  '/admin': { icon: LayoutDashboard, group: 'Pilotage' },
  '/admin/etablissements': { icon: Building2, group: 'Annuaire' },
  '/admin/etablissements/import': { icon: FileSpreadsheet, group: 'Annuaire' },
  '/admin/revendications': { icon: BadgeCheck, group: 'Annuaire' },
  '/admin/modifications': { icon: FilePen, group: 'Annuaire' },
  '/admin/avis': { icon: Star, group: 'Annuaire' },
  '/admin/dis-moi-tout': { icon: Megaphone, group: 'Demandes' },
  '/admin/devis': { icon: FileSignature, group: 'Demandes' },
  '/admin/messages': { icon: Mail, group: 'Demandes' },
  '/admin/blog': { icon: Newspaper, group: 'Contenu' },
  '/admin/commentaires': { icon: MessagesSquare, group: 'Contenu' },
  '/admin/categories': { icon: Tags, group: 'Contenu' },
  '/admin/pages': { icon: FileText, group: 'Contenu' },
  '/admin/partenaires': { icon: Handshake, group: 'Site' },
  '/admin/newsletter': { icon: Send, group: 'Site' },
  '/admin/parametres': { icon: Settings, group: 'Site' },
  '/admin/utilisateurs': { icon: Users, group: 'Système' },
  '/admin/referentiels': { icon: ListTree, group: 'Système' },
  '/admin/journal': { icon: ScrollText, group: 'Système' },
};
const GROUP_ORDER = ['Pilotage', 'Annuaire', 'Demandes', 'Contenu', 'Site', 'Système'];

function groupNav(items: AdminNavItem[]) {
  const groups = new Map<string, AdminNavItem[]>();
  for (const item of items) {
    const group = NAV_META[item.href]?.group ?? 'Autres';
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

function initials(first?: string, last?: string): string {
  return `${(first ?? '').trim().charAt(0)}${(last ?? '').trim().charAt(0)}`.toUpperCase() || '?';
}

/**
 * Coquille de l'administration (maquette admin-v1) : thème clair/sombre scopé (data-admin-theme,
 * sombre par défaut, choix mémorisé en cookie et relu côté serveur), barre latérale à rubriques,
 * barre du haut (indicateurs, thème, notifications, compte), menu repliable sur mobile.
 */
export function AdminShell({
  children,
  initialTheme = 'dark',
}: {
  children: ReactNode;
  initialTheme?: AdminTheme;
}) {
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);

  function toggleTheme() {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    persistAdminTheme(next);
  }

  return (
    <div data-admin-theme={theme} className="admin-app">
      <AdminAccessGate>
        <AdminFrame theme={theme} onToggleTheme={toggleTheme}>
          {children}
        </AdminFrame>
      </AdminAccessGate>
    </div>
  );
}

function AdminFrame({
  children,
  theme,
  onToggleTheme,
}: {
  children: ReactNode;
  theme: AdminTheme;
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const nav = adminNavFor(user?.role);
  const current = activeHref(pathname, nav);
  const isAdmin = user?.role === 'admin';
  const counts = useAdminCounts(isAdmin, pathname);
  const perNav = navCounts(counts);
  // Le menu mobile se referme à chaque changement de page (état lié au chemin).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const burgerRef = useRef<HTMLButtonElement>(null);
  // Échap referme le menu mobile et rend le focus au bouton qui l'a ouvert.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Une boîte de dialogue ouverte traite elle-même Échap.
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
      setOpenFor(null);
      burgerRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const zone = user?.role === 'editor' ? 'Gestion du contenu' : 'Administration';
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Mon compte';

  return (
    <div className="admin-frame">
      <a href="#contenu-admin" className="admin-skip">
        Aller au contenu de l’administration
      </a>
      <aside className="admin-side" aria-label="Navigation de l’administration">
        <div className="admin-side-head">
          <Link href={adminHomeFor(user?.role)} className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/elephant-icon-192.png" alt="" width={34} height={34} />
            <span>
              <span>PROTECT</span>
              <b>ICI</b>
              <small>{zone}</small>
            </span>
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className="admin-burger"
            aria-expanded={open}
            aria-controls="menu-admin"
            onClick={() => setOpenFor(open ? null : pathname)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            {open ? 'Fermer le menu' : 'Menu'}
          </button>
        </div>
        <nav
          id="menu-admin"
          aria-label="Administration"
          className={cn('admin-nav', open && 'admin-nav-open')}
        >
          {groupNav(nav).map(([group, items]) => (
            <div key={group} className="admin-nav-group">
              <p className="admin-nav-title" aria-hidden="true">
                {group}
              </p>
              <ul>
                {items.map((l) => {
                  const active = l.href === current;
                  const Icon = NAV_META[l.href]?.icon;
                  const count = perNav[l.href] ?? 0;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={active ? 'page' : undefined}
                        className="admin-nav-link"
                      >
                        {Icon ? <Icon aria-hidden="true" /> : null}
                        <span className="min-w-0 flex-1">{l.label}</span>
                        {count > 0 ? (
                          <span className="admin-count">
                            {count}
                            <span className="sr-only"> à traiter</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {user?.two_factor_enabled ? (
          <div className="admin-promo">
            <p className="admin-promo-title">Double authentification active</p>
            <p>Votre session expire après 30 minutes d’inactivité.</p>
            <Link href="/compte">
              <LockKeyhole aria-hidden="true" />
              Sécurité du compte
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          {counts ? (
            <ul className="admin-chips" aria-label="Indicateurs">
              <li className="admin-chip">
                <span className="admin-chip-dot">
                  <TriangleAlert aria-hidden="true" />
                </span>
                {totalTodo(counts)} à traiter
              </li>
              <li className="admin-chip">
                <span className="admin-chip-dot admin-chip-dot-ok">
                  <Check aria-hidden="true" />
                </span>
                {counts.providers_approved + counts.state_forces_approved} fiches publiées
              </li>
            </ul>
          ) : null}
          <div className="admin-top-actions">
            <Link href="/" className="admin-pill-link">
              <ExternalLink aria-hidden="true" />
              <span className="max-sm:sr-only">Voir le site</span>
            </Link>
            <AdminThemeToggle theme={theme} onToggle={onToggleTheme} />
            {/* Notifications d'administration : rôle admin seulement (l'API refuse l'éditeur). */}
            {isAdmin ? <NotificationBell /> : null}
            <Link href="/compte" className="admin-avatar" title={displayName}>
              <span aria-hidden="true">
                {initials(user?.first_name, user?.last_name)}
              </span>
              <span className="sr-only">Mon compte ({displayName})</span>
            </Link>
            <button type="button" className="admin-icon-btn" onClick={() => void logout()}>
              <LogOut aria-hidden="true" />
              <span className="sr-only">Déconnexion</span>
            </button>
          </div>
        </header>
        <div id="contenu-admin" tabIndex={-1} className="admin-page">
          {children}
        </div>
      </div>
    </div>
  );
}
