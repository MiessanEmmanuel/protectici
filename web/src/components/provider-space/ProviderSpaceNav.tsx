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
      <ul className="flex overflow-x-auto overscroll-x-contain border-b-2 border-ink">
        {LINKS.map((l) => {
          const current = isCurrent(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-tap shrink-0 items-center px-4 text-sm font-extrabold whitespace-nowrap no-underline',
                  current
                    ? 'bg-ink text-white'
                    : 'text-ink-2 underline-offset-4 hover:text-ink hover:underline',
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
