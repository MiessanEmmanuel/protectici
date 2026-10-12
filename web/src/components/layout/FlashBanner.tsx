'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FlashItem } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { Container } from '../ui/Container';

function FlashList({ items, duplicate = false }: { items: FlashItem[]; duplicate?: boolean }) {
  return (
    <ul
      className="flash-list"
      data-duplicate={duplicate ? 'true' : undefined}
      aria-hidden={duplicate ? true : undefined}
      inert={duplicate ? true : undefined}
    >
      {items.map((i) => (
        <li key={i.slug} className="whitespace-nowrap">
          <time dateTime={i.published_at} className="mr-2 font-semibold text-accent">
            {formatTime(i.published_at)}
          </time>
          <Link href={`/blog/${i.slug}`} className="inline-flex min-h-6 items-center text-link-on-night">
            {i.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Bandeau « Flash info » défilant. Accessibilité : pause au survol et au focus clavier, bouton
 * Pause/Reprendre (WCAG 2.2.2), défilement supprimé avec prefers-reduced-motion (liste statique),
 * copie dupliquée masquée aux technologies d'assistance.
 */
export function FlashBanner({ items }: { items: FlashItem[] }) {
  const [paused, setPaused] = useState(false);
  if (items.length === 0) return null;
  return (
    <section aria-label="Flash info" className="bg-night text-sm text-on-night">
      <Container className="flex items-center gap-3 py-1">
        <p className="shrink-0 rounded-sm bg-accent px-2 py-0.5 font-bold text-on-accent">
          Flash info
        </p>
        <div className="flash-viewport min-w-0 flex-1">
          <div className="flash-track" data-paused={paused ? 'true' : 'false'}>
            <FlashList items={items} />
            <FlashList items={items} duplicate />
          </div>
        </div>
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="inline-flex min-h-tap shrink-0 items-center rounded-md border border-on-night/40 px-3 hover:bg-on-night/10 motion-reduce:hidden"
        >
          {paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
        </button>
      </Container>
    </section>
  );
}
