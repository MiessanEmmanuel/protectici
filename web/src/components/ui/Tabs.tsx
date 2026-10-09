'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/** Onglets accessibles (motif WAI-ARIA : flèches, Début/Fin, rôle tablist/tab/tabpanel). */
export function Tabs({ tabs, label, initial }: { tabs: TabDef[]; label: string; initial?: string }) {
  const uid = useId();
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? '');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const target = tabs[next]!;
    setActive(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              role="tab"
              id={`${uid}-tab-${t.id}`}
              type="button"
              aria-selected={selected}
              aria-controls={`${uid}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'min-h-tap shrink-0 border-b-2 px-4 font-semibold whitespace-nowrap',
                selected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${uid}-panel-${t.id}`}
          aria-labelledby={`${uid}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="pt-5"
        >
          {t.id === active ? t.content : null}
        </div>
      ))}
    </div>
  );
}
