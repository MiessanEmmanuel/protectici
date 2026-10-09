'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type {
  EstablishmentAction,
  EstablishmentDocument,
  EstablishmentType,
} from '@/lib/api/types';
import { formatBytes } from '@/lib/files';
import { formatDateTime, formatFcfa } from '@/lib/format';
import {
  COLLECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  eventLabel,
  POSITIONS,
  SUBMITTER_LABELS,
  TYPE_LABELS,
} from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { MiniMap } from '../../map/MiniMap';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ExternalLink } from '../../ui/ExternalLink';
import { FormError } from '../../ui/Field';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { LoadingBlock } from '../../ui/Spinner';
import { StatusBadge } from '../../ui/StatusBadge';
import { Badge } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { formatChangeValue } from '../modifications/change-format';
import { ChangeDiff } from '../modifications/ChangeDiff';
import { AdminEstablishmentEditForm } from './AdminEstablishmentEditForm';

type Dialog = 'approve' | 'reject' | 'suspend' | 'delete';

const CR_LABELS = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' } as const;

const SUCCESS: Record<EstablishmentAction, string> = {
  approve: 'Fiche approuvée.',
  reject: 'Fiche rejetée.',
  suspend: 'Fiche suspendue.',
  restore: 'Fiche rétablie.',
  verify: 'Badge « vérifié » accordé.',
  unverify: 'Badge « vérifié » retiré.',
};

function friendly(e: unknown): unknown {
  if (e instanceof ApiError && e.status === 404) {
    return new ApiError(404, 'Cette fiche est introuvable : elle a peut-être été supprimée.');
  }
  if (e instanceof ApiError && e.status === 409) {
    return new ApiError(
      409,
      e.message || 'La fiche a changé d’état entre-temps. Rechargez la page et réessayez.',
    );
  }
  return e;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false;
  return (
    <div className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="break-words">{empty ? <span className="text-muted">Non renseigné</span> : children}</dd>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </Card>
  );
}

const yesNo = (v: boolean | undefined) => (v ? 'Oui' : 'Non');

export function AdminEstablishmentDetail({ type, id }: { type: EstablishmentType; id: number }) {
  const router = useRouter();
  const toast = useToast();
  const state = useResource(() => clientApi.adminGetEstablishment(type, id), [type, id]);
  const reference = useResource(() => clientApi.getReferenceData(), []);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const inflight = useRef(false);

  /** Exécute une action en un seul exemplaire à la fois ; relance l'erreur (affichée par l'appelant). */
  async function guarded(fn: () => Promise<void>, success: string) {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setPageError(null);
    try {
      await fn();
      setNotice(success);
      toast.show(success, 'success');
    } catch (e) {
      const f = friendly(e);
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) state.reload();
      throw f;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function act(action: EstablishmentAction, reason?: string) {
    await guarded(async () => {
      await clientApi.adminEstablishmentAction(type, id, action, reason);
      state.reload();
    }, SUCCESS[action]);
  }

  async function quick(action: EstablishmentAction) {
    try {
      await act(action);
    } catch (e) {
      setPageError(errorMessage(e));
    }
  }

  async function toggleFeatured(current: boolean) {
    try {
      await guarded(async () => {
        const updated = await clientApi.adminUpdateEstablishment(type, id, { is_featured: !current });
        state.setData(updated);
      }, current ? 'Fiche retirée de la une.' : 'Fiche mise en avant.');
    } catch (e) {
      setPageError(errorMessage(e));
    }
  }

  async function remove(name: string) {
    if (inflight.current) return;
    // En cas d'erreur, guarded relance : la boîte reste ouverte et affiche le message.
    await guarded(async () => {
      try {
        await clientApi.adminDeleteEstablishment(type, id, name);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e; // déjà supprimée : rejeu
      }
    }, 'Fiche supprimée.');
    router.push('/admin/etablissements');
  }

  async function download(doc: EstablishmentDocument) {
    if (downloading !== null) return;
    setDownloading(doc.id);
    setPageError(null);
    try {
      const blob = await clientApi.adminDownloadDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      state.reload(); // l'accès vient d'être journalisé : l'historique est mis à jour
    } catch (e) {
      const msg = errorMessage(e);
      setPageError(msg);
      toast.show(msg, 'error');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/etablissements">← Retour aux établissements</Link>
      </p>
      <QueryBoundary state={state} loadingLabel="Chargement de la fiche…">
        {(e) => {
          const ref = reference.data;
          const city = ref?.cities.find((c) => c.id === e.city_id);
          const district = city?.districts.find((d) => d.id === e.district_id);
          const forceType = ref?.state_force_types.find((t) => t.id === e.force_type_id);
          const ids = (field: string, v: unknown[] | undefined) =>
            v && v.length ? formatChangeValue(field, v, ref) : null;
          const canApprove = ['draft', 'pending', 'rejected'].includes(e.status);
          const canReject = ['draft', 'pending'].includes(e.status);
          const pendingChanges = e.change_requests.filter((c) => c.status === 'pending').length;

          return (
            <>
              <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold sm:text-3xl">{e.name}</h1>
                  <StatusBadge status={e.status} />
                  {e.is_verified ? <Badge tone="success">Vérifié</Badge> : null}
                  {e.is_featured ? <Badge tone="accent">À la une</Badge> : null}
                  {!e.is_visible ? <Badge>Non publiée</Badge> : null}
                </div>
                <p className="text-muted">
                  {TYPE_LABELS[e.type]} · fiche n° {e.id}
                </p>
                {e.rejection_reason ? (
                  <p className="rounded-md border border-line bg-surface-alt p-3">
                    <strong>Motif :</strong> {e.rejection_reason}
                  </p>
                ) : null}
              </header>

              <section aria-label="Actions sur la fiche" className="flex flex-col gap-3">
                <FormError message={pageError} />
                <p role="status" aria-live="polite" className="sr-only">
                  {notice}
                </p>
                <div className="flex flex-wrap gap-3">
                  {canApprove ? (
                    <Button disabled={busy} onClick={() => setDialog('approve')}>
                      Approuver
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button variant="secondary" disabled={busy} onClick={() => setDialog('reject')}>
                      Rejeter
                    </Button>
                  ) : null}
                  {e.status === 'approved' ? (
                    <Button variant="secondary" disabled={busy} onClick={() => setDialog('suspend')}>
                      Suspendre
                    </Button>
                  ) : null}
                  {e.status === 'suspended' ? (
                    <Button disabled={busy} onClick={() => void quick('restore')}>
                      Rétablir
                    </Button>
                  ) : null}
                  {e.type === 'provider' && e.status === 'approved' && !e.is_verified ? (
                    <Button variant="secondary" disabled={busy} onClick={() => void quick('verify')}>
                      Vérifier
                    </Button>
                  ) : null}
                  {e.type === 'provider' && e.is_verified ? (
                    <Button variant="secondary" disabled={busy} onClick={() => void quick('unverify')}>
                      Retirer la vérification
                    </Button>
                  ) : null}
                  <Button variant="secondary" disabled={busy} onClick={() => void toggleFeatured(e.is_featured)}>
                    {e.is_featured ? 'Retirer de la une' : 'Mettre en avant'}
                  </Button>
                  {!editing ? (
                    <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
                      Modifier
                    </Button>
                  ) : null}
                  <Button variant="danger" disabled={busy} onClick={() => setDialog('delete')}>
                    Supprimer
                  </Button>
                </div>
              </section>

              {editing ? (
                ref ? (
                  <AdminEstablishmentEditForm
                    establishment={e}
                    reference={ref}
                    onCancel={() => setEditing(false)}
                    onSaved={(updated) => {
                      state.setData(updated);
                      setEditing(false);
                      setNotice('Fiche enregistrée.');
                      toast.show('Fiche enregistrée.', 'success');
                    }}
                  />
                ) : (
                  <LoadingBlock label="Chargement des listes…" />
                )
              ) : (
                <>
                  <Section title="Identité et statut" id="s-identite">
                    <dl className="flex flex-col gap-2">
                      <Row label="Type">{TYPE_LABELS[e.type]}</Row>
                      <Row label="Identifiant public">{e.slug}</Row>
                      <Row label="Description">{e.description}</Row>
                      {e.type === 'provider' ? (
                        <>
                          <Row label="Types d’entreprise">{ids('company_type_ids', e.company_type_ids)}</Row>
                          <Row label="Services">{ids('service_type_ids', e.service_type_ids)}</Row>
                          <Row label="En service">{yesNo(e.is_in_service)}</Row>
                          <Row label="Déposée par">
                            {e.submitter_role ? SUBMITTER_LABELS[e.submitter_role] : null}
                          </Row>
                        </>
                      ) : (
                        <>
                          <Row label="Type de structure">
                            {forceType?.name ?? (e.force_type_id ? `n° ${e.force_type_id}` : null)}
                          </Row>
                          <Row label="Démarches">{ids('procedure_type_ids', e.procedure_type_ids)}</Row>
                        </>
                      )}
                      <Row label="Soumise le">{formatDateTime(e.submitted_at)}</Row>
                      <Row label="Examinée">
                        {e.reviewed_at
                          ? `${formatDateTime(e.reviewed_at)}${e.reviewed_by ? ` par ${e.reviewed_by.name}` : ''}`
                          : null}
                      </Row>
                      <Row label="Visible sur le site">{yesNo(e.is_visible)}</Row>
                      <Row label="Nombre de vues">{String(e.views_count)}</Row>
                    </dl>
                  </Section>

                  <Section title="Propriétaire" id="s-proprietaire">
                    <dl className="flex flex-col gap-2">
                      <Row label="Nom">{`${e.owner.first_name} ${e.owner.last_name}`.trim()}</Row>
                      <Row label="Adresse e-mail">{e.owner.email}</Row>
                      <Row label="Téléphone">{e.owner.phone}</Row>
                    </dl>
                  </Section>

                  {e.type === 'provider' ? (
                    <Section title="Informations légales" id="s-legal">
                      <p className="text-sm text-muted">
                        Données sensibles : ne les communiquez pas en dehors de l’administration.
                      </p>
                      <dl className="flex flex-col gap-2">
                        <Row label="Numéro RCCM">{e.rccm}</Row>
                        <Row label="Forme juridique">{e.legal_form}</Row>
                        <Row label="Capital social">
                          {e.share_capital !== null && e.share_capital !== undefined
                            ? formatFcfa(e.share_capital)
                            : null}
                        </Row>
                        <Row label="Objet social">{e.corporate_purpose}</Row>
                        <Row label="Numéro d’agrément">{e.approval_number}</Row>
                        <Row label="Fin de validité de l’agrément">{e.approval_expires_at}</Row>
                      </dl>
                    </Section>
                  ) : null}

                  {e.type === 'provider' ? (
                    <Section title="Dirigeants" id="s-dirigeants">
                      {e.executives.length === 0 ? (
                        <p className="text-muted">Aucun dirigeant renseigné.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {e.executives.map((x) => (
                            <li key={x.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{x.full_name}</span>
                              <span>
                                {x.position === 'other' && x.position_label
                                  ? x.position_label
                                  : POSITIONS[x.position]}
                              </span>
                              <Badge>{x.is_visible ? 'Visible publiquement' : 'Masqué'}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Section>
                  ) : null}

                  <Section title="Localisation" id="s-localisation">
                    <dl className="flex flex-col gap-2">
                      <Row label="Ville">{city?.name ?? (e.city_id ? `n° ${e.city_id}` : null)}</Row>
                      <Row label="Quartier">{district?.name ?? (e.district_id ? `n° ${e.district_id}` : null)}</Row>
                      <Row label="Adresse">{e.address}</Row>
                      <Row label="Repères géographiques">{e.geo_description}</Row>
                      <Row label="Plus Code">{e.plus_code}</Row>
                      <Row label="Coordonnées">
                        {e.lat !== null && e.lng !== null ? `${e.lat}, ${e.lng}` : null}
                      </Row>
                    </dl>
                    {e.lat !== null && e.lng !== null ? (
                      <MiniMap name={e.name} lat={e.lat} lng={e.lng} address={e.address} />
                    ) : null}
                  </Section>

                  <Section title="Contacts" id="s-contacts">
                    <dl className="flex flex-col gap-2">
                      <Row label="Téléphone">{e.phone}</Row>
                      <Row label="Second téléphone">{e.phone_alt}</Row>
                      <Row label="Téléphone d’urgence">{e.emergency_phone}</Row>
                      <Row label="Adresse e-mail">{e.email}</Row>
                      {e.type === 'provider' ? (
                        <>
                          <Row label="Site web">
                            <ExternalLink href={e.website_url}>{e.website_url}</ExternalLink>
                          </Row>
                          <Row label="Facebook">
                            <ExternalLink href={e.facebook_url}>{e.facebook_url}</ExternalLink>
                          </Row>
                          <Row label="Instagram">
                            <ExternalLink href={e.instagram_url}>{e.instagram_url}</ExternalLink>
                          </Row>
                          <Row label="X (Twitter)">
                            <ExternalLink href={e.twitter_url}>{e.twitter_url}</ExternalLink>
                          </Row>
                          <Row label="LinkedIn">
                            <ExternalLink href={e.linkedin_url}>{e.linkedin_url}</ExternalLink>
                          </Row>
                          <Row label="Numéro WhatsApp">{e.whatsapp_number}</Row>
                          <Row label="Tarif de départ">
                            {e.price_from !== null && e.price_from !== undefined ? formatFcfa(e.price_from) : null}
                          </Row>
                        </>
                      ) : (
                        <>
                          <Row label="Horaires">{e.opening_hours}</Row>
                          <Row label="Ouvert 24 h/24">{yesNo(e.is_open_24h)}</Row>
                        </>
                      )}
                    </dl>
                  </Section>
                </>
              )}

              <Section title="Médias" id="s-medias">
                {e.media.length === 0 ? (
                  <p className="text-muted">Aucun média.</p>
                ) : (
                  <ul className="flex flex-wrap gap-4">
                    {e.media.map((m) => (
                      <li key={m.id} className="flex max-w-48 flex-col gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.url}
                          alt={m.alt}
                          loading="lazy"
                          className="h-28 w-full rounded-md border border-line object-cover"
                        />
                        <span className="text-sm text-muted">{COLLECTION_LABELS[m.collection]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Justificatifs" id="s-justificatifs">
                <p className="text-sm text-muted">
                  Documents privés. Chaque téléchargement est journalisé (qui, quand) dans l’historique.
                </p>
                {e.documents.length === 0 ? (
                  <p className="text-muted">Aucun justificatif déposé.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {e.documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{d.original_name}</p>
                          <p className="text-sm text-muted">
                            {DOCUMENT_TYPE_LABELS[d.type]} · {formatBytes(d.size_bytes)} · déposé le{' '}
                            {formatDateTime(d.uploaded_at)}
                            {d.verified_at ? ` · vérifié le ${formatDateTime(d.verified_at)}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          aria-label={`Télécharger ${d.original_name}`}
                          loading={downloading === d.id}
                          disabled={downloading !== null}
                          onClick={() => void download(d)}
                        >
                          Télécharger
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Demandes de modification" id="s-demandes">
                {pendingChanges > 0 ? (
                  <p>
                    {pendingChanges} demande{pendingChanges > 1 ? 's' : ''} en attente.{' '}
                    <Link href="/admin/modifications">Les traiter</Link>
                  </p>
                ) : null}
                {e.change_requests.length === 0 ? (
                  <p className="text-muted">Aucune demande de modification.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {e.change_requests.map((c) => (
                      <li key={c.id} className="flex flex-col gap-2">
                        <p className="text-sm text-muted">
                          <Badge tone={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'accent'}>
                            {CR_LABELS[c.status]}
                          </Badge>{' '}
                          demandée le {formatDateTime(c.created_at)}
                          {c.reviewed_at ? ` · traitée le ${formatDateTime(c.reviewed_at)}` : ''}
                        </p>
                        {c.rejection_reason ? <p>Motif du rejet : {c.rejection_reason}</p> : null}
                        <ChangeDiff changes={c.changes} reference={ref} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Historique" id="s-historique">
                {e.audit.length === 0 ? (
                  <p className="text-muted">Aucun événement.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {e.audit.map((a, i) => (
                      <li key={i}>
                        <span className="font-semibold">{eventLabel(a.event)}</span>
                        <span className="text-muted">
                          {' '}
                          · {a.user?.name ?? 'Système'} · {formatDateTime(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              <ConfirmDialog
                open={dialog === 'approve'}
                onClose={() => setDialog(null)}
                title="Approuver la fiche"
                confirmLabel="Approuver"
                onConfirm={() => act('approve')}
              >
                <p>
                  La fiche <strong>{e.name}</strong> sera publiée et son propriétaire sera prévenu par
                  e-mail.
                </p>
              </ConfirmDialog>
              <ConfirmDialog
                open={dialog === 'reject'}
                onClose={() => setDialog(null)}
                title="Rejeter la fiche"
                confirmLabel="Rejeter"
                tone="danger"
                reasonLabel="Motif du rejet"
                onConfirm={(reason) => act('reject', reason)}
              >
                <p>Le motif sera communiqué au propriétaire de la fiche.</p>
              </ConfirmDialog>
              <ConfirmDialog
                open={dialog === 'suspend'}
                onClose={() => setDialog(null)}
                title="Suspendre la fiche"
                confirmLabel="Suspendre"
                tone="danger"
                reasonLabel="Motif de la suspension"
                onConfirm={(reason) => act('suspend', reason)}
              >
                <p>La fiche ne sera plus visible sur le site tant qu’elle n’est pas rétablie.</p>
              </ConfirmDialog>
              <ConfirmDialog
                open={dialog === 'delete'}
                onClose={() => setDialog(null)}
                title="Supprimer la fiche"
                confirmLabel="Supprimer définitivement"
                tone="danger"
                expectedText={e.name}
                expectedLabel="Nom de la fiche"
                onConfirm={() => remove(e.name)}
              >
                <p>
                  La fiche sera retirée du site (suppression logique, conservée dans l’historique).
                  Cette action est sensible.
                </p>
              </ConfirmDialog>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
