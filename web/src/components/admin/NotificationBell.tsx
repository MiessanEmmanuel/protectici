'use client';

import { useCallback, useEffect, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { AdminNotification } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '../ui/Button';
import { FormError } from '../ui/Field';

const POLL_MS = 60_000;

/** Cloche des notifications internes (nouvelle fiche, demande de modification, justificatif). */
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
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls="panneau-notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">🔔</span>
        <span className="sr-only">Notifications, </span>
        <span>
          {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Aucune nouveauté'}
        </span>
      </Button>
      {open ? (
        <section
          id="panneau-notifications"
          aria-label="Notifications internes"
          className="absolute right-0 z-30 mt-2 w-[min(92vw,26rem)] rounded-lg border border-line bg-surface p-4 shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Notifications</h2>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
          <FormError message={error} />
          {items.length === 0 ? (
            <p className="mt-2 text-muted">Aucune notification pour le moment.</p>
          ) : (
            <ul className="mt-2 flex max-h-80 flex-col divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className={n.read_at ? 'text-muted' : 'font-semibold'}>
                      {n.message ?? 'Nouvelle notification'}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(n.created_at)}</p>
                  </div>
                  {n.read_at ? (
                    <span className="text-xs text-muted">Lue</span>
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
