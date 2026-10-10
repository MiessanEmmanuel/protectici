'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../ui/cn';

const LINKS = [
  { href: '/espace-prestataire', label: 'Mes établissements' },
  { href: '/espace-prestataire/avis', label: 'Avis reçus' },
  { href: '/espace-prestataire/devis', label: 'Devis reçus' },
] as const;

/** Navigation commune de l’espace prestataire (la page courante porte `aria-current`). */
export function ProviderSpaceNav() {
  const pathname = usePathname() ?? '';
  const isCurrent = (href: string) =>
    href === '/espace-prestataire'
      ? !pathname.startsWith('/espace-prestataire/avis') && !pathname.startsWith('/espace-prestataire/devis')
      : pathname === href;
  return (
    <nav aria-label="Espace prestataire">
      <ul className="flex flex-wrap gap-2">
        {LINKS.map((l) => {
          const current = isCurrent(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-tap items-center rounded-md border px-4 no-underline',
                  current
                    ? 'border-primary bg-primary font-bold text-on-primary'
                    : 'border-line bg-surface font-semibold text-primary hover:bg-primary-soft',
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
