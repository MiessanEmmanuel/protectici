'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FlashItem } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion';

/** Durée d'affichage d'une dépêche (ms). */
export const FLASH_INTERVAL_MS = 6000;

const ctl =
  'inline-flex min-h-[50px] min-w-12 items-center justify-center border-l-2 border-current px-3 [&_svg]:size-[1.15em]';

/**
 * Flash info v9 : UNE dépêche à la fois sur aplat or.
 * - Rotation automatique toutes les 6 s, suspendue au survol et au focus (WCAG 2.2.2) ;
 * - boutons Précédente / Pause-Reprendre / Suivante ; une action manuelle met en pause ;
 * - aucune rotation automatique si prefers-reduced-motion (pause par défaut) ;
 * - aria-live="polite" seulement en pause (pas d'annonces intempestives pendant la rotation) ;
 * - sans JavaScript : la première dépêche reste affichée.
 */
export function FlashBanner({ items }: { items: FlashItem[] }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [hold, setHold] = useState(false);
  const paused = userPaused ?? reduced;
  const count = items.length;

  useEffect(() => {
    if (paused || hold || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), FLASH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, hold, count]);

  if (count === 0) return null;
  const current = items[index % count]!;

  function step(delta: number) {
    setIndex((i) => (i + delta + count) % count);
    setUserPaused(true);
  }

  return (
    <section
      aria-label="Flash info"
      aria-roledescription="dépêches"
      className="bg-c2 text-on-c2"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
    >
      <div className="wrap flex min-h-[50px] items-stretch">
        <p className="flex flex-none items-center gap-2.5 bg-c3 px-4 text-[0.85rem] font-black tracking-[0.08em] text-on-c3 uppercase [&_svg]:size-[1.2em]">
          <Radio aria-hidden="true" />
          <span className="max-sm:sr-only">Flash info</span>
        </p>
        <div
          aria-live={paused ? 'polite' : 'off'}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-4"
        >
          <p key={current.slug} className="pi-fade flex min-w-0 items-center gap-2.5">
            <time dateTime={current.published_at} className="flex-none font-black">
              {formatTime(current.published_at).replace(':', 'H')}
            </time>
            <Link
              href={`/blog/${current.slug}`}
              className="truncate font-semibold text-inherit no-underline hover:underline"
            >
              {current.title}
            </Link>
          </p>
        </div>
        {count > 1 ? (
          <>
            <span
              aria-hidden="true"
              className="hidden flex-none items-center border-l-2 border-current px-3 text-[0.78rem] font-extrabold sm:flex"
            >
              {(index % count) + 1} / {count}
            </span>
            <div className="flex flex-none">
              <button
                type="button"
                className={ctl}
                aria-label="Dépêche précédente"
                onClick={() => step(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className={ctl}
                aria-pressed={paused}
                aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
                onClick={() => setUserPaused(!paused)}
              >
                {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={ctl}
                aria-label="Dépêche suivante"
                onClick={() => step(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
