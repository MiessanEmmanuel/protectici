'use client';

import {
  Building2,
  FilePen,
  FileSignature,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTree,
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
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { adminNavFor, type AdminNavItem } from '@/lib/admin-access';
import { useSession } from '../layout/SessionProvider';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { AdminAccessGate } from './AdminAccessGate';
import { NotificationBell } from './NotificationBell';

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Icône et rubrique de chaque entrée (présentation seulement : la liste vient de adminNavFor). */
const NAV_META: Record<string, { icon: LucideIcon; group: string }> = {
  '/admin': { icon: LayoutDashboard, group: 'Pilotage' },
  '/admin/etablissements': { icon: Building2, group: 'Annuaire' },
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

/** Cadre de la zone d'administration : garde d'accès, navigation latérale repliable, cloche. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const nav = adminNavFor(user?.role);
  // Le menu mobile se referme à chaque changement de page (état lié au chemin).
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const zone = user?.role === 'editor' ? 'Gestion du contenu' : 'Administration';

  return (
    <AdminAccessGate>
      <div className="wrap flex flex-col gap-5 py-6 lg:flex-row lg:items-start lg:gap-8 lg:py-8">
        <aside className="border-2 border-ink bg-white lg:sticky lg:top-[calc(var(--spacing-header)+1rem)] lg:max-h-[calc(100dvh-var(--spacing-header)-2rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-3 bg-c3 px-4 py-2 text-on-c3">
            <p className="eyebrow">{zone}</p>
            <Button
              variant="light"
              size="sm"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="menu-admin"
              onClick={() => setOpenFor(open ? null : pathname)}
            >
              {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              {open ? 'Fermer le menu' : 'Menu d’administration'}
            </Button>
          </div>
          <nav
            id="menu-admin"
            aria-label="Administration"
            className={cn('lg:block', open ? 'block' : 'hidden')}
          >
            {groupNav(nav).map(([group, items]) => (
              <div key={group} className="border-t-2 border-ink first:border-t-0">
                <p className="eyebrow px-4 pt-3 pb-1 text-ink-2" aria-hidden="true">
                  {group}
                </p>
                <ul className="flex flex-col pb-2">
                  {items.map((l) => {
                    const active = isActive(pathname, l.href, l.exact);
                    const Icon = NAV_META[l.href]?.icon;
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-tap items-center gap-2.5 border-l-4 px-3 text-sm no-underline [&_svg]:size-4 [&_svg]:shrink-0',
                            active
                              ? 'border-ink bg-c1 font-extrabold text-on-c1'
                              : 'border-transparent font-semibold text-ink hover:border-ink hover:bg-c4',
                          )}
                        >
                          {Icon ? <Icon aria-hidden="true" /> : null}
                          {l.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex justify-end">
            <NotificationBell />
          </div>
          {children}
        </div>
      </div>
    </AdminAccessGate>
  );
}
