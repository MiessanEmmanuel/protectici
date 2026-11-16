import type { Role } from './api/types';

/**
 * Accès à l'administration par rôle — confort UX uniquement : l'API Laravel autorise (ou refuse)
 * chaque appel. `editor` : blog, commentaires, catégories, pages. `admin` : tout.
 */

/**
 * Import Excel des fiches : le front est prêt mais l'API (`/admin/establishment-imports*`) n'existe
 * pas encore (recette R05). Tant que ce drapeau vaut `false`, l'entrée de menu, le bouton
 * « Importer un fichier », le filtre « Lot d'import » et les pages d'import sont masqués, et aucun
 * appel n'est fait à l'API d'import. Le code du module est conservé pour la suite.
 */
export const IMPORTS_ENABLED = false;

export type AdminScope = 'content' | 'admin';

export interface AdminNavItem {
  href: string;
  label: string;
  scope: AdminScope;
  exact?: boolean;
}

const ALL_ADMIN_NAV: readonly AdminNavItem[] = [
  { href: '/admin', label: 'Tableau de bord', scope: 'admin', exact: true },
  { href: '/admin/blog', label: 'Blog', scope: 'content' },
  { href: '/admin/commentaires', label: 'Commentaires du blog', scope: 'content' },
  { href: '/admin/categories', label: 'Catégories du blog', scope: 'content' },
  { href: '/admin/pages', label: 'Pages institutionnelles', scope: 'content' },
  { href: '/admin/etablissements', label: 'Établissements', scope: 'admin' },
  { href: '/admin/etablissements/import', label: 'Import Excel', scope: 'admin' },
  { href: '/admin/revendications', label: 'Revendications', scope: 'admin' },
  { href: '/admin/modifications', label: 'Demandes de modification', scope: 'admin' },
  { href: '/admin/avis', label: 'Avis et signalements', scope: 'admin' },
  { href: '/admin/dis-moi-tout', label: 'Dis-moi tout', scope: 'admin' },
  { href: '/admin/devis', label: 'Devis', scope: 'admin' },
  { href: '/admin/messages', label: 'Messages de contact', scope: 'admin' },
  { href: '/admin/partenaires', label: 'Partenaires et clients', scope: 'admin' },
  { href: '/admin/newsletter', label: 'Newsletter', scope: 'admin' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', scope: 'admin' },
  { href: '/admin/referentiels', label: 'Référentiels', scope: 'admin' },
  { href: '/admin/parametres', label: 'Paramètres du site', scope: 'admin' },
  { href: '/admin/journal', label: 'Journal d’audit', scope: 'admin' },
];

export const ADMIN_NAV: readonly AdminNavItem[] = IMPORTS_ENABLED
  ? ALL_ADMIN_NAV
  : ALL_ADMIN_NAV.filter((i) => i.href !== '/admin/etablissements/import');

function matches(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function scopeOfPath(pathname: string): AdminScope {
  const item = ADMIN_NAV.find((i) => !i.exact && matches(pathname, i.href));
  return item?.scope ?? 'admin';
}

export function canAccessAdminPath(role: Role | null | undefined, pathname: string): boolean {
  if (role === 'admin') return true;
  if (role === 'editor') return scopeOfPath(pathname) === 'content';
  return false;
}

export function adminNavFor(role: Role | null | undefined): AdminNavItem[] {
  if (role === 'admin') return [...ADMIN_NAV];
  if (role === 'editor') return ADMIN_NAV.filter((i) => i.scope === 'content');
  return [];
}

/** Page d'accueil de l'administration selon le rôle. */
export function adminHomeFor(role: Role | null | undefined): string {
  return role === 'editor' ? '/admin/blog' : '/admin';
}
