'use client';

import Link from 'next/link';
import { clientApi } from '@/lib/api/client';
import { eventLabel } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { ArrowRight } from 'lucide-react';
import { cn } from '../ui/cn';
import { QueryBoundary } from '../ui/QueryBoundary';
import { AdminPageHeader } from './AdminPageHeader';

export function AdminDashboardView() {
  const state = useResource(() => clientApi.adminDashboard(), []);
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Pilotage" title="Tableau de bord" />
      <QueryBoundary state={state} loadingLabel="Chargement du tableau de bord…">
        {(d) => (
          <>
            <section aria-labelledby="a-traiter" className="flex flex-col gap-3">
              <h2 id="a-traiter" className="text-xl heading-block">
                À traiter
              </h2>
              <ul className="grid-ruled grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                <Counter todo label="Avis à modérer" value={d.pending_reviews} href="/admin/avis" />
                <Counter
                  todo
                  label="Signalements d'avis ouverts"
                  value={d.open_review_reports}
                  href="/admin/avis"
                />
                <Counter
                  todo
                  label="Nouveaux « Dis-moi tout »"
                  value={d.new_feedbacks}
                  href="/admin/dis-moi-tout"
                />
                <Counter todo label="Nouveaux devis" value={d.new_quote_requests} href="/admin/devis" />
                <Counter
                  todo
                  label="Nouveaux messages de contact"
                  value={d.new_contact_messages}
                  href="/admin/messages"
                />
                <Counter
                  todo
                  label="Prestataires en attente"
                  value={d.pending_providers}
                  href="/admin/etablissements?type=provider&status=pending"
                />
                <Counter
                  todo
                  label="Forces étatiques en attente"
                  value={d.pending_state_forces}
                  href="/admin/etablissements?type=state_force&status=pending"
                />
                <Counter
                  todo
                  label="Commentaires du blog à modérer"
                  value={d.pending_comments}
                  href="/admin/commentaires"
                />
                <Counter
                  todo
                  label="Demandes de modification"
                  value={d.pending_change_requests}
                  href="/admin/modifications"
                />
              </ul>
            </section>
            <section aria-labelledby="en-chiffres" className="flex flex-col gap-3">
              <h2 id="en-chiffres" className="text-xl heading-block">
                En chiffres
              </h2>
              <ul className="grid-ruled grid grid-cols-2 lg:grid-cols-4">
                <Counter
                  label="Abonnés confirmés à la newsletter"
                  value={d.confirmed_subscribers}
                  href="/admin/newsletter"
                />
                <Counter label="Utilisateurs" value={d.users_total} href="/admin/utilisateurs" />
                <Counter label="Prestataires validés" value={d.providers_approved} />
                <Counter label="Forces étatiques validées" value={d.state_forces_approved} />
              </ul>
            </section>
            <section aria-labelledby="derniers-evenements" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="derniers-evenements" className="text-xl heading-block">
                  Derniers événements
                </h2>
                <Link
                  href="/admin/journal"
                  className="inline-flex min-h-tap items-center gap-1.5 font-extrabold text-ink [&_svg]:size-4"
                >
                  Voir tout le journal
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              {d.recent_audit.length === 0 ? (
                <p className="text-muted">Aucun événement récent.</p>
              ) : (
                <div className="border-2 border-ink bg-white">
                  <ul className="divide-y divide-line-soft">
                    {d.recent_audit.map((a) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                        <span>
                          <span className="font-bold">{eventLabel(a.event)}</span>
                          {a.user ? <span className="text-muted"> par {a.user.name}</span> : null}
                        </span>
                        <time dateTime={a.created_at} className="text-ink-2">
                          {formatDateTime(a.created_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Counter({
  label,
  value,
  href,
  todo = false,
}: {
  label: string;
  value: number;
  href?: string;
  /** Compteur « à traiter » : en aplat or dès qu'il y a quelque chose à faire. */
  todo?: boolean;
}) {
  const pending = todo && value > 0;
  const body = (
    <>
      <span className="block text-[2rem] heading-block">{value}</span>
      <span className="mt-1 block text-sm leading-snug font-bold">{label}</span>
    </>
  );
  return (
    <li className={cn('relative', pending ? 'bg-c2 text-on-c2' : 'bg-white text-ink')}>
      {href ? (
        <Link
          href={href}
          className="block h-full min-h-tap p-4 text-inherit no-underline hover:bg-ink hover:text-white"
        >
          {body}
        </Link>
      ) : (
        <div className="h-full p-4">{body}</div>
      )}
    </li>
  );
}
