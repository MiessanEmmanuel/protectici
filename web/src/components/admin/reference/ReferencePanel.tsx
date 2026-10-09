'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AdminReferenceInput, AdminReferenceItem, ReferenceResource } from '@/lib/api/types';
import { REFERENCE_LABELS } from '@/lib/labels';
import { useAsyncAction, useResource } from '@/lib/use-async';
import { Badge } from '../../ui/Tag';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { ReferenceForm } from './ReferenceForm';

const IN_USE = 'Valeur utilisée, masquez-la plutôt.';

type Editing = { item: AdminReferenceItem | null } | null;

export function ReferencePanel({ resource }: { resource: ReferenceResource }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [toDelete, setToDelete] = useState<AdminReferenceItem | null>(null);
  const [conflict, setConflict] = useState<{ item: AdminReferenceItem; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toggle = useAsyncAction();

  const state = useResource(() => clientApi.adminListReference(resource, page), [resource, page]);
  const cities = useResource(
    () => (resource === 'districts' ? clientApi.adminListReference('cities') : Promise.resolve(null)),
    [resource],
  );
  const cityName = (id?: number | null) =>
    cities.data?.data.find((c) => c.id === id)?.name ?? (id != null ? `Ville n° ${id}` : '—');

  const label = REFERENCE_LABELS[resource];

  async function save(input: AdminReferenceInput) {
    if (editing?.item) {
      await clientApi.adminUpdateReference(resource, editing.item.id, input);
      setNotice(`« ${input.name} » modifiée.`);
    } else {
      await clientApi.adminCreateReference(resource, input);
      setNotice(`« ${input.name} » créée.`);
    }
    setEditing(null);
    setConflict(null);
    state.reload();
  }

  async function setVisibility(item: AdminReferenceItem, isVisible: boolean) {
    const res = await toggle.run(() =>
      clientApi.adminUpdateReference(resource, item.id, { is_visible: isVisible }),
    );
    if (res.ok) {
      setNotice(`« ${item.name} » : ${isVisible ? 'affichée' : 'masquée'}.`);
      if (conflict?.item.id === item.id) setConflict(null);
      state.reload();
    }
  }

  async function remove(item: AdminReferenceItem) {
    try {
      await clientApi.adminDeleteReference(resource, item.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict({ item, message: e.message || IN_USE });
        return; // la boîte se ferme ; le conflit est présenté dans la page avec « Masquer plutôt »
      }
      throw e;
    }
    setNotice(`« ${item.name} » supprimée.`);
    setConflict(null);
    state.reload();
  }

  const cityOptions = cities.data?.data.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const parentOptions = state.data?.data.map((d) => ({ id: d.id, name: d.name })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{label}</h2>
        <Button onClick={() => setEditing({ item: null })}>Ajouter une valeur</Button>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-success">
        {notice}
      </p>
      {conflict ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-soft p-4">
          <p className="flex-1">
            <strong>{conflict.item.name}</strong> : {conflict.message}
          </p>
          {conflict.item.is_visible ? (
            <Button
              variant="secondary"
              loading={toggle.busy}
              onClick={() => setVisibility(conflict.item, false)}
            >
              Masquer plutôt
            </Button>
          ) : null}
        </div>
      ) : null}
      <FormError message={toggle.error?.form} />

      <QueryBoundary state={state} loadingLabel={`Chargement : ${label}…`}>
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState title="Aucune valeur pour ce référentiel" />
          ) : (
            <div>
              <Table caption={label}>
                <THead>
                  <Tr>
                    <Th>Nom</Th>
                    <Th>Identifiant</Th>
                    <Th>Ordre</Th>
                    <Th>Statut</Th>
                    <Th>Détails</Th>
                    <Th>Actions</Th>
                  </Tr>
                </THead>
                <tbody>
                  {list.data.map((it) => (
                    <Tr key={it.id}>
                      <Td className="font-semibold">{it.name}</Td>
                      <Td className="text-muted">{it.slug}</Td>
                      <Td>{it.sort_order}</Td>
                      <Td>
                        <Badge tone={it.is_visible ? 'success' : 'neutral'}>
                          {it.is_visible ? 'Visible' : 'Masquée'}
                        </Badge>
                      </Td>
                      <Td className="max-w-xs">
                        <Details resource={resource} item={it} cityName={cityName} />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Modifier ${it.name}`}
                            onClick={() => setEditing({ item: it })}
                          >
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={toggle.busy}
                            aria-label={`${it.is_visible ? 'Masquer' : 'Afficher'} ${it.name}`}
                            onClick={() => setVisibility(it, !it.is_visible)}
                          >
                            {it.is_visible ? 'Masquer' : 'Afficher'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            aria-label={`Supprimer ${it.name}`}
                            onClick={() => setToDelete(it)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <PagerButtons meta={list.meta} onPage={setPage} disabled={state.loading} />
            </div>
          )
        }
      </QueryBoundary>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.item ? `Modifier « ${editing.item.name} »` : `Ajouter : ${label}`}
      >
        {editing ? (
          <ReferenceForm
            resource={resource}
            item={editing.item}
            cities={cityOptions}
            parents={parentOptions}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      {toDelete ? (
        <ConfirmDialog
          open
          onClose={() => setToDelete(null)}
          title="Supprimer la valeur"
          confirmLabel="Supprimer"
          tone="danger"
          expectedText={toDelete.name}
          expectedLabel="Nom de la valeur"
          onConfirm={() => remove(toDelete)}
        >
          <p>
            Supprimer définitivement <strong>{toDelete.name}</strong> ? Si elle est utilisée, la
            suppression sera refusée : vous pourrez alors la masquer.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function Details({
  resource,
  item,
  cityName,
}: {
  resource: ReferenceResource;
  item: AdminReferenceItem;
  cityName: (id?: number | null) => string;
}) {
  if (resource === 'cities') {
    return <span>{item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : 'Sans coordonnées'}</span>;
  }
  if (resource === 'districts') {
    return (
      <span>
        {cityName(item.city_id)}
        {item.parent_id != null ? ` · parent n° ${item.parent_id}` : ''}
      </span>
    );
  }
  return <span className="line-clamp-2">{item.description || '—'}</span>;
}
