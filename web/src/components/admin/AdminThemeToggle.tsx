'use client';

import { Moon, Sun } from 'lucide-react';
import type { AdminTheme } from '@/lib/admin-theme';

/** Bascule clair / sombre de l'administration (icône seule, libellé accessible explicite). */
export function AdminThemeToggle({
  theme,
  onToggle,
}: {
  theme: AdminTheme;
  onToggle: () => void;
}) {
  const light = theme === 'light';
  const label = light ? 'Passer en mode sombre' : 'Passer en mode clair';
  return (
    <button
      type="button"
      className="admin-icon-btn"
      aria-pressed={light}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {light ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}
