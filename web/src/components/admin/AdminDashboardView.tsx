'use client';

import Link from 'next/link';
import { clientApi } from '@/lib/api/client';
import { eventLabel } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { Card } from '../ui/Card';
import { QueryBoundary } from '../ui/QueryBoundary';

export function AdminDashboardView() {
  const state = useResource(() => clientApi.adminDashboard(), []);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Tableau de bord</h1>
      <QueryBoundary state={state} loadingLabel="Chargement du tableau de bord…">
        {(d) => (
          <>
            <section aria-labelledby="a-traiter" className="flex flex-col gap-3">
              <h2 id="a-traiter" className="text-xl font-bold">
                À traiter
              </h2>
              <ul className="grid gap-4 sm:grid-cols-3">
                <Counter label="Avis à modérer" value={d.pending_reviews} href="/admin/avis" />
                <Counter
                  label="Signalements d'avis ouverts"
                  value={d.open_review_reports}
                  href="/admin/avis"
                />
                <Counter
                  label="Nouveaux « Dis-moi tout »"
                  value={d.new_feedbacks}
                  href="/admin/dis-moi-tout"
                />
                <Counter label="Nouveaux devis" value={d.new_quote_requests} href="/admin/devis" />
                <Counter
                  label="Nouveaux messages de contact"
                  value={d.new_contact_messages}
                  href="/admin/messages"
                />
                <Counter
                  label="Prestataires en attente"
                  value={d.pending_providers}
                  href="/admin/etablissements?type=provider&status=pending"
                />
                <Counter
                  label="Forces étatiques en attente"
                  value={d.pending_state_forces}
                  href="/admin/etablissements?type=state_force&status=pending"
                />
                <Counter
                  label="Demandes de modification"
                  value={d.pending_change_requests}
                  href="/admin/modifications"
                />
              </ul>
            </section>
            <section aria-labelledby="en-chiffres" className="flex flex-col gap-3">
              <h2 id="en-chiffres" className="text-xl font-bold">
                En chiffres
              </h2>
              <ul className="grid gap-4 sm:grid-cols-3">
                <Counter label="Utilisateurs" value={d.users_total} href="/admin/utilisateurs" />
                <Counter label="Prestataires validés" value={d.providers_approved} />
                <Counter label="Forces étatiques validées" value={d.state_forces_approved} />
              </ul>
            </section>
            <section aria-labelledby="derniers-evenements" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="derniers-evenements" className="text-xl font-bold">
                  Derniers événements
                </h2>
                <Link href="/admin/journal">Voir tout le journal</Link>
              </div>
              {d.recent_audit.length === 0 ? (
                <p className="text-muted">Aucun événement récent.</p>
              ) : (
                <Card as="div" className="p-0 sm:p-0">
                  <ul className="divide-y divide-line">
                    {d.recent_audit.map((a) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                        <span>
                          <span className="font-semibold">{eventLabel(a.event)}</span>
                          {a.user ? <span className="text-muted"> par {a.user.name}</span> : null}
                        </span>
                        <time dateTime={a.created_at} className="text-sm text-muted">
                          {formatDateTime(a.created_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Counter({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <span className="block text-3xl font-bold text-primary-active">{value}</span>
      <span className="block text-muted">{label}</span>
    </>
  );
  return (
    <li>
      <Card className="h-full">
        {href ? (
          <Link href={href} className="block no-underline hover:underline">
            {body}
          </Link>
        ) : (
          body
        )}
      </Card>
    </li>
  );
}
