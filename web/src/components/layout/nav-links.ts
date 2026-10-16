import {
  Building2,
  FileText,
  Landmark,
  MessageSquareWarning,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  /** Libellé long (menu mobile). */
  longLabel?: string;
  icon: LucideIcon;
}

/** Navigation principale (en-tête et menu mobile). Les icônes sont décoratives (aria-hidden). */
export const NAV_LINKS: NavLink[] = [
  { href: '/annuaire', label: 'Prestataires', icon: Building2 },
  { href: '/forces-etatiques', label: 'Forces de l’État', icon: Landmark },
  { href: '/devis', label: 'Devis', longLabel: 'Demande de devis', icon: FileText },
  { href: '/dis-moi-tout', label: 'Dis-moi tout', icon: MessageSquareWarning },
  { href: '/blog', label: 'Actualités', icon: Newspaper },
];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
