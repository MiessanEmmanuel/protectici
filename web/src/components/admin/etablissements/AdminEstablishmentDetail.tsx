'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type {
  AdminEstablishment,
  EstablishmentAction,
  EstablishmentDocument,
  EstablishmentType,
} from '@/lib/api/types';
import { formatBytes } from '@/lib/files';
import { formatDateTime, formatFcfa, formatPhone } from '@/lib/format';
import {
  COLLECTION_LABELS,
  DOCUMENT_TYPE_LABELS,
  eventLabel,
  legalFormLabel,
  POSITIONS,
  SUBMITTER_LABELS,
  TYPE_LABELS,
} from '@/lib/labels';
import { formatOpeningHours } from '@/lib/opening-hours';
import { useResource } from '@/lib/use-async';
import { MiniMap } from '../../map/MiniMap';
import { Button } from '../../ui/Button';
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
import { AdminPageHeader } from '../AdminPageHeader';
import { AssignOwnerPanel } from '../revendications/AssignOwnerPanel';
import { DefList, DefRow, insetClasses, Panel, PanelNote } from './panel';

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

const Row = DefRow;

function Section({
  title,
  id,
  hint,
  children,
}: {
  title: string;
  id: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel aria-labelledby={id} title={title} titleId={id} hint={hint}>
      {children}
    </Panel>
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
      await guarded(
        async () => {
          const updated = await clientApi.adminUpdateEstablishment(type, id, {
            is_featured: !current,
          });
          state.setData(updated);
        },
        current ? 'Fiche retirée de la une.' : 'Fiche mise en avant.',
      );
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
        <Link
          href="/admin/etablissements"
          className="inline-flex min-h-tap items-center gap-2 rounded-full border border-line bg-surface-alt px-4 text-sm font-semibold text-ink no-underline hover:bg-c4"
        >
          <span aria-hidden="true">←</span> Retour aux établissements
        </Link>
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
              <AdminPageHeader
                section={`${TYPE_LABELS[e.type]} · fiche n° ${e.id}`}
                title={e.name}
                meta={
                  <>
                    <StatusBadge status={e.status} />
                    {e.is_verified ? <Badge tone="success">Vérifié</Badge> : null}
                    {e.is_featured ? <Badge tone="accent">À la une</Badge> : null}
                    {!e.is_visible ? <Badge>Non publiée</Badge> : null}
                  </>
                }
                description={
                  e.rejection_reason ? (
                    <p className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-ink">
                      <strong>Motif :</strong> {e.rejection_reason}
                    </p>
                  ) : null
                }
              />

              <section
                aria-label="Actions sur la fiche"
                className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 sm:p-5"
              >
                <p className="text-sm font-semibold text-muted">Décision et mise en avant</p>
                <FormError message={pageError} />
                <p role="status" aria-live="polite" className="sr-only">
                  {notice}
                </p>
                <div className="flex flex-wrap gap-2">
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
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setDialog('suspend')}
                    >
                      Suspendre
                    </Button>
                  ) : null}
                  {e.status === 'suspended' ? (
                    <Button disabled={busy} onClick={() => void quick('restore')}>
                      Rétablir
                    </Button>
                  ) : null}
                  {e.type === 'provider' && e.status === 'approved' && !e.is_verified ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void quick('verify')}
                    >
                      Vérifier
                    </Button>
                  ) : null}
                  {e.type === 'provider' && e.is_verified ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void quick('unverify')}
                    >
                      Retirer la vérification
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void toggleFeatured(e.is_featured)}
                  >
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

              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="flex min-w-0 flex-col gap-6">
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
                        <DefList>
                          <Row label="Type">{TYPE_LABELS[e.type]}</Row>
                          <Row label="Identifiant public">{e.slug}</Row>
                          <Row label="Description">{e.description}</Row>
                          {e.type === 'provider' ? (
                            <>
                              <Row label="Types d’entreprise">
                                {ids('company_type_ids', e.company_type_ids)}
                              </Row>
                              <Row label="Services">
                                {ids('service_type_ids', e.service_type_ids)}
                              </Row>
                              <Row label="En service">{yesNo(e.is_in_service)}</Row>
                              <Row label="Déposée par">
                                {e.submitter_role ? SUBMITTER_LABELS[e.submitter_role] : null}
                              </Row>
                            </>
                          ) : (
                            <>
                              <Row label="Type de structure">
                                {forceType?.name ??
                                  (e.force_type_id ? `n° ${e.force_type_id}` : null)}
                              </Row>
                              <Row label="Démarches">
                                {ids('procedure_type_ids', e.procedure_type_ids)}
                              </Row>
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
                        </DefList>
                      </Section>

                      {/* Fiche importée ou non revendiquée : `owner` vaut null (contrat §10). */}
                      {(e.owner as AdminEstablishment['owner'] | null) ? (
                        <Section title="Propriétaire" id="s-proprietaire">
                          <DefList>
                            <Row label="Nom">
                              {`${e.owner.first_name} ${e.owner.last_name}`.trim()}
                            </Row>
                            <Row label="Adresse e-mail">{e.owner.email}</Row>
                            <Row label="Téléphone">{e.owner.phone}</Row>
                          </DefList>
                        </Section>
                      ) : (
                        <AssignOwnerPanel
                          type={e.type}
                          id={e.id}
                          name={e.name}
                          onAssigned={(updated) => state.setData(updated)}
                        />
                      )}

                      {e.type === 'provider' ? (
                        <Section title="Informations légales" id="s-legal">
                          <PanelNote>
                            Données sensibles : ne les communiquez pas en dehors de
                            l’administration.
                          </PanelNote>
                          <DefList>
                            <Row label="Numéro RCCM">{e.rccm}</Row>
                            <Row label="Forme juridique">{legalFormLabel(e.legal_form)}</Row>
                            <Row label="Capital social">
                              {e.share_capital !== null && e.share_capital !== undefined
                                ? formatFcfa(e.share_capital)
                                : null}
                            </Row>
                            <Row label="Objet social">{e.corporate_purpose}</Row>
                            <Row label="Numéro d’agrément">{e.approval_number}</Row>
                            <Row label="Fin de validité de l’agrément">{e.approval_expires_at}</Row>
                          </DefList>
                        </Section>
                      ) : null}

                      {e.type === 'provider' ? (
                        <Section title="Dirigeants" id="s-dirigeants">
                          {(e.executives ?? []).length === 0 ? (
                            <p className="text-muted">Aucun dirigeant renseigné.</p>
                          ) : (
                            <ul className="flex flex-col gap-2">
                              {(e.executives ?? []).map((x) => (
                                <li
                                  key={x.id}
                                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${insetClasses}`}
                                >
                                  <span className="font-semibold">{x.full_name}</span>
                                  <span className="text-muted">
                                    {x.position === 'other' && x.position_label
                                      ? x.position_label
                                      : POSITIONS[x.position]}
                                  </span>
                                  <Badge className="ml-auto">
                                    {x.is_visible ? 'Visible publiquement' : 'Masqué'}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Section>
                      ) : null}

                      <Section title="Localisation" id="s-localisation">
                        <DefList>
                          <Row label="Ville">
                            {city?.name ?? (e.city_id ? `n° ${e.city_id}` : null)}
                          </Row>
                          <Row label="Quartier">
                            {district?.name ?? (e.district_id ? `n° ${e.district_id}` : null)}
                          </Row>
                          <Row label="Adresse">{e.address}</Row>
                          <Row label="Repères géographiques">{e.geo_description}</Row>
                          <Row label="Plus Code">{e.plus_code}</Row>
                          <Row label="Coordonnées">
                            {e.lat !== null && e.lng !== null ? `${e.lat}, ${e.lng}` : null}
                          </Row>
                        </DefList>
                        <MiniMap
                          name={e.name}
                          lat={e.lat}
                          lng={e.lng}
                          address={e.address}
                          branches={e.branches}
                        />
                      </Section>

                      {e.type === 'provider' ? (
                        <Section title="Agences" id="s-agences" hint="En plus du siège.">
                          {e.branches.length === 0 ? (
                            <p className="text-muted">Aucune agence renseignée.</p>
                          ) : (
                            <ul className="flex flex-col gap-2">
                              {e.branches.map((b) => {
                                const branchCity = ref?.cities.find((c) => c.id === b.city_id);
                                const branchDistrict = branchCity?.districts.find(
                                  (d) => d.id === b.district_id,
                                );
                                return (
                                  <li key={b.id} className={`break-words ${insetClasses}`}>
                                    <p className="font-semibold">{b.label}</p>
                                    <p className="text-muted">
                                      {[
                                        branchDistrict?.name,
                                        branchCity?.name ?? `Ville n° ${b.city_id}`,
                                      ]
                                        .filter(Boolean)
                                        .join(', ')}
                                    </p>
                                    {b.address ? <p className="mt-1">{b.address}</p> : null}
                                    {b.geo_description ? (
                                      <p className="text-sm text-muted">{b.geo_description}</p>
                                    ) : null}
                                    {b.phone ? (
                                      <p className="mt-1">{formatPhone(b.phone)}</p>
                                    ) : null}
                                    <p className="mt-1 text-sm text-muted">
                                      {b.lat !== null && b.lng !== null
                                        ? `Coordonnées : ${b.lat}, ${b.lng}`
                                        : 'Non géolocalisée'}
                                    </p>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </Section>
                      ) : null}

                      <Section title="Contacts" id="s-contacts">
                        <DefList>
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
                                <ExternalLink href={e.instagram_url}>
                                  {e.instagram_url}
                                </ExternalLink>
                              </Row>
                              <Row label="X (Twitter)">
                                <ExternalLink href={e.twitter_url}>{e.twitter_url}</ExternalLink>
                              </Row>
                              <Row label="LinkedIn">
                                <ExternalLink href={e.linkedin_url}>{e.linkedin_url}</ExternalLink>
                              </Row>
                              <Row label="Numéro WhatsApp">{e.whatsapp_number}</Row>
                              <Row label="Tarif de départ">
                                {e.price_from !== null && e.price_from !== undefined
                                  ? formatFcfa(e.price_from)
                                  : null}
                              </Row>
                            </>
                          ) : (
                            <>
                              <Row label="Horaires">
                                <span className="whitespace-pre-line">
                                  {formatOpeningHours(e.opening_hours, e.is_open_24h)}
                                </span>
                              </Row>
                              <Row label="Ouvert 24 h/24">{yesNo(e.is_open_24h)}</Row>
                            </>
                          )}
                        </DefList>
                      </Section>
                    </>
                  )}

                  <Section title="Demandes de modification" id="s-demandes">
                    {pendingChanges > 0 ? (
                      <p className="rounded-md bg-warning-soft px-3 py-2">
                        {pendingChanges} demande{pendingChanges > 1 ? 's' : ''} en attente.{' '}
                        <Link href="/admin/modifications">Les traiter</Link>
                      </p>
                    ) : null}
                    {e.change_requests.length === 0 ? (
                      <p className="text-muted">Aucune demande de modification.</p>
                    ) : (
                      <ul className="flex flex-col gap-4">
                        {e.change_requests.map((c) => (
                          <li key={c.id} className={`flex flex-col gap-2 ${insetClasses}`}>
                            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                              <Badge
                                tone={
                                  c.status === 'approved'
                                    ? 'success'
                                    : c.status === 'rejected'
                                      ? 'danger'
                                      : 'accent'
                                }
                              >
                                {CR_LABELS[c.status]}
                              </Badge>
                              demandée le {formatDateTime(c.created_at)}
                              {c.reviewed_at
                                ? ` · traitée le ${formatDateTime(c.reviewed_at)}`
                                : ''}
                            </p>
                            {c.rejection_reason ? (
                              <p>Motif du rejet : {c.rejection_reason}</p>
                            ) : null}
                            <ChangeDiff changes={c.changes} reference={ref} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>
                <div className="flex min-w-0 flex-col gap-6">
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
                            <span className="text-sm text-muted">
                              {COLLECTION_LABELS[m.collection]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title="Justificatifs" id="s-justificatifs">
                    <PanelNote>
                      Documents privés. Chaque téléchargement est journalisé (qui, quand) dans
                      l’historique.
                    </PanelNote>
                    {e.documents.length === 0 ? (
                      <p className="text-muted">Aucun justificatif déposé.</p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {e.documents.map((d) => (
                          <li
                            key={d.id}
                            className={`flex flex-wrap items-center justify-between gap-3 ${insetClasses}`}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold break-words">{d.original_name}</p>
                              <p className="text-sm text-muted">
                                {DOCUMENT_TYPE_LABELS[d.type]} · {formatBytes(d.size_bytes)} ·
                                déposé le {formatDateTime(d.uploaded_at)}
                                {d.verified_at
                                  ? ` · vérifié le ${formatDateTime(d.verified_at)}`
                                  : ''}
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

                  <Section title="Historique" id="s-historique">
                    {e.audit.length === 0 ? (
                      <p className="text-muted">Aucun événement.</p>
                    ) : (
                      <ol className="flex flex-col">
                        {e.audit.map((a, i) => (
                          <li
                            key={i}
                            className="relative border-l border-line py-2 pl-5 before:absolute before:top-3.5 before:-left-[5px] before:size-2.5 before:rounded-full before:bg-accent-text"
                          >
                            <span className="font-semibold">{eventLabel(a.event)}</span>
                            <span className="block text-sm text-muted">
                              {a.user?.name ?? 'Système'} · {formatDateTime(a.created_at)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Section>
                </div>
              </div>

              <ConfirmDialog
                open={dialog === 'approve'}
                onClose={() => setDialog(null)}
                title="Approuver la fiche"
                confirmLabel="Approuver"
                onConfirm={() => act('approve')}
              >
                <p>
                  La fiche <strong>{e.name}</strong> sera publiée et son propriétaire sera prévenu
                  par e-mail.
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
