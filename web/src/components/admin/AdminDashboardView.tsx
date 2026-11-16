'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronRight, ScrollText } from 'lucide-react';
import { clientApi } from '@/lib/api/client';
import type { AdminDashboard } from '@/lib/api/types';
import { eventLabel } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { useSession } from '../layout/SessionProvider';
import { cn } from '../ui/cn';
import { QueryBoundary } from '../ui/QueryBoundary';
import { totalTodo } from './admin-counts';

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Files « à traiter » hors des trois cartes prioritaires (tuiles de liens, sans nouvel endpoint). */
function otherQueues(d: AdminDashboard) {
  return [
    { label: 'Signalements d’avis ouverts', value: d.open_review_reports, href: '/admin/avis' },
    { label: 'Demandes de modification', value: d.pending_change_requests, href: '/admin/modifications' },
    { label: 'Revendications en attente', value: d.pending_claims ?? 0, href: '/admin/revendications' },
    { label: 'Nouveaux devis', value: d.new_quote_requests, href: '/admin/devis' },
    { label: 'Nouveaux messages de contact', value: d.new_contact_messages, href: '/admin/messages' },
    { label: 'Commentaires du blog à modérer', value: d.pending_comments, href: '/admin/commentaires' },
  ];
}

/** Tableau de bord (maquette admin-v1) : uniquement les données réelles de GET /admin/dashboard. */
export function AdminDashboardView() {
  const state = useResource(() => clientApi.adminDashboard(), []);
  const { user } = useSession();
  return (
    <QueryBoundary state={state} loadingLabel="Chargement du tableau de bord…">
      {(d) => {
        const total = totalTodo(d);
        const pendingSheets = d.pending_providers + d.pending_state_forces;
        const prio = [
          {
            n: '01',
            title: 'Avis à modérer',
            value: d.pending_reviews,
            href: '/admin/avis',
            foot: `${d.open_review_reports} ${plural(d.open_review_reports, 'signalement ouvert', 'signalements ouverts')}`,
          },
          {
            n: '02',
            title: 'Fiches en attente',
            value: pendingSheets,
            href: '/admin/etablissements?status=pending',
            foot: `${d.pending_providers} ${plural(d.pending_providers, 'prestataire', 'prestataires')} · ${d.pending_state_forces} ${plural(d.pending_state_forces, 'force', 'forces')}`,
            gold: true,
          },
          {
            n: '03',
            title: 'Dis-moi tout',
            value: d.new_feedbacks,
            href: '/admin/dis-moi-tout',
            foot: `${plural(d.new_feedbacks, 'Nouveau dossier', 'Nouveaux dossiers')}`,
          },
        ];
        const first = [...prio, ...otherQueues(d)].find((q) => q.value > 0);
        return (
          <div className="admin-dash">
            <section className="admin-hero" aria-labelledby="dash-titre">
              <div>
                <p className="admin-hero-hi">Bonjour{user?.first_name ? `, ${user.first_name}` : ''}</p>
                <h1 id="dash-titre" className="admin-hero-title">
                  {total > 0 ? (
                    <>
                      {total} {plural(total, 'élément attend', 'éléments attendent')} votre{' '}
                      <em>décision</em>
                    </>
                  ) : (
                    <>
                      Rien à traiter <em>pour le moment</em>
                    </>
                  )}
                </h1>
                <div className="admin-hero-actions">
                  {first ? (
                    <Link href={first.href} className="ui-btn ui-btn-accent admin-hero-btn">
                      Commencer la modération
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  ) : null}
                  <Link href="/admin/journal" className="admin-hero-ghost">
                    Voir le journal
                  </Link>
                </div>
              </div>
              <ul className="admin-prio" aria-label="Priorités">
                {prio.map((p) => (
                  <li key={p.n}>
                    <Link href={p.href} className={cn('admin-pcard', p.gold && 'admin-pcard-gold')}>
                      <span>
                        <span className="admin-pcard-n" aria-hidden="true">
                          {p.n}
                        </span>
                        <span className="admin-pcard-title">{p.title}</span>
                      </span>
                      <span className="admin-pcard-big">{p.value}</span>
                      <span className="admin-pcard-foot">
                        {p.foot}
                        <span className="admin-pcard-go" aria-hidden="true">
                          <ArrowUpRight />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <div className="admin-dash-main">
              <section className="admin-block" aria-labelledby="en-chiffres">
                <div className="admin-block-head">
                  <h2 id="en-chiffres">En chiffres</h2>
                </div>
                <ul className="admin-stats">
                  <Stat label="Prestataires validés" value={d.providers_approved} />
                  <Stat label="Forces étatiques validées" value={d.state_forces_approved} />
                  <Stat label="Utilisateurs" value={d.users_total} href="/admin/utilisateurs" />
                  <Stat
                    label="Abonnés confirmés à la newsletter"
                    value={d.confirmed_subscribers}
                    href="/admin/newsletter"
                  />
                </ul>
              </section>

              <section className="admin-block" aria-labelledby="autres-files">
                <div className="admin-block-head">
                  <h2 id="autres-files">Autres files à traiter</h2>
                </div>
                <ul className="admin-queue">
                  {otherQueues(d).map((q) => (
                    <li key={q.label}>
                      <Link href={q.href} className="admin-queue-link">
                        <span className={cn('admin-queue-n', q.value > 0 && 'admin-queue-hot')}>
                          {q.value}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold">{q.label}</span>
                        <span className="admin-queue-act" aria-hidden="true">
                          {q.value > 0 ? 'Traiter' : 'Ouvrir'}
                          <ChevronRight />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="admin-rail" aria-label="Activité">
              <section className="admin-block" aria-labelledby="derniers-evenements">
                <div className="admin-block-head">
                  <h2 id="derniers-evenements">Derniers événements</h2>
                  <Link href="/admin/journal">Voir tout le journal</Link>
                </div>
                {d.recent_audit.length === 0 ? (
                  <p className="text-muted">Aucun événement récent.</p>
                ) : (
                  <ul className="admin-mini">
                    {d.recent_audit.map((a) => (
                      <li key={a.id}>
                        <ScrollText aria-hidden="true" />
                        <div className="min-w-0">
                          <span className="font-semibold">{eventLabel(a.event)}</span>
                          <small>
                            {a.user ? `${a.user.name} · ` : ''}
                            <time dateTime={a.created_at}>{formatDateTime(a.created_at)}</time>
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value">{value}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="admin-stat admin-stat-link">
          {body}
        </Link>
      ) : (
        <div className="admin-stat">{body}</div>
      )}
    </li>
  );
}
