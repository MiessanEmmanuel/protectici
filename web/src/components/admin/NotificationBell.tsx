'use client';

import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { AdminNotification } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '../ui/Button';
import { FormError } from '../ui/Field';

const POLL_MS = 60_000;

/** Cloche des notifications internes (bouton rond de la barre du haut, pastille du nombre de non lues) (nouvelle fiche, demande de modification, justificatif). */
export function NotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setItems(await clientApi.adminListNotifications());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // Chargement initial hors du corps synchrone de l'effet, puis interrogation périodique.
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id: AdminNotification['id']) {
    const key = String(id);
    if (marking.has(key)) return;
    setMarking((s) => new Set(s).add(key));
    try {
      await clientApi.adminMarkNotificationRead(id);
      setItems((list) =>
        list.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setMarking((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="admin-icon-btn"
        aria-expanded={open}
        aria-controls="panneau-notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden="true" />
        <span className="sr-only">
          Notifications,{' '}
          {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'aucune nouveauté'}
        </span>
        {unread > 0 ? (
          <span className="admin-bell-dot" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          id="panneau-notifications"
          aria-label="Notifications internes"
          className="absolute right-0 z-30 mt-2 w-[26rem] max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:w-auto rounded-lg border border-line bg-white p-4 text-ink shadow-[0_18px_48px_rgb(0_0_0/0.35)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg heading-block">Notifications</h2>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
          <FormError message={error} />
          {items.length === 0 ? (
            <p className="mt-2 text-muted">Aucune notification pour le moment.</p>
          ) : (
            <ul className="mt-2 flex max-h-80 flex-col divide-y divide-line-soft scroll-y">
              {items.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className={n.read_at ? 'text-muted' : 'font-semibold'}>
                      {n.message ?? 'Nouvelle notification'}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(n.created_at)}</p>
                  </div>
                  {n.read_at ? (
                    <span className="rounded-full bg-c4 px-2.5 py-1 text-xs font-semibold text-on-c4">Lue</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={marking.has(String(n.id))}
                      onClick={() => void markRead(n.id)}
                      aria-label={`Marquer comme lue : ${n.message ?? 'notification'}`}
                    >
                      Marquer comme lue
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
