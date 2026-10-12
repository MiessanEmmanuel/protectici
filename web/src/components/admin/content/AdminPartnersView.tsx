'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { ContentPartner, PartnerType } from '@/lib/api/types';
import { partnerFormSchema } from '@/lib/content-schemas';
import { useResource } from '@/lib/use-async';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Modal } from '../../ui/Modal';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { Textarea } from '../../ui/Textarea';
import { useToast } from '../../ui/Toast';

const TYPE_LABELS: Record<PartnerType, string> = { partner: 'Partenaire', client: 'Client' };

/** Partenaires et clients (admin uniquement côté API). */
export function AdminPartnersView() {
  const [type, setType] = useState<PartnerType | ''>('');
  const [editing, setEditing] = useState<ContentPartner | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ContentPartner | null>(null);
  const toast = useToast();
  const list = useResource(() => clientApi.contentListPartners(type || undefined), [type]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Partenaires et clients</h1>
        <Button onClick={() => setEditing('new')}>Ajouter</Button>
      </div>
      <Select label="Type" value={type} wrapperClassName="sm:w-64" onChange={(e) => setType(e.target.value as PartnerType | '')}>
        <option value="">Tous</option>
        <option value="partner">Partenaires</option>
        <option value="client">Clients</option>
      </Select>
      <QueryBoundary state={list} loadingLabel="Chargement…">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="Aucune entrée" />
          ) : (
            <Table caption="Partenaires et clients">
              <THead>
                <Tr><Th>Nom</Th><Th>Type</Th><Th>Ordre</Th><Th>Visible</Th><Th>Actions</Th></Tr>
              </THead>
              <tbody>
                {rows.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-semibold">{p.name}</Td>
                    <Td>{TYPE_LABELS[p.type]}</Td>
                    <Td>{p.sort_order}</Td>
                    <Td>{p.is_visible ? 'Oui' : 'Non'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>
                          Modifier<span className="sr-only"> {p.name}</span>
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setToDelete(p)}>
                          Supprimer<span className="sr-only"> {p.name}</span>
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryBoundary>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Ajouter un partenaire ou un client' : 'Modifier'}>
        {editing !== null ? (
          <PartnerForm
            partner={editing === 'new' ? undefined : editing}
            onDone={() => {
              setEditing(null);
              toast.show('Enregistré.', 'success');
              list.reload();
            }}
          />
        ) : null}
      </Modal>
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer"
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={async () => {
          if (!toDelete) return;
          await clientApi.contentDeletePartner(toDelete.id);
          toast.show('Entrée supprimée.', 'success');
          list.reload();
        }}
      >
        <p>Supprimer « {toDelete?.name} » ?</p>
      </ConfirmDialog>
    </div>
  );
}

function PartnerForm({ partner, onDone }: { partner?: ContentPartner; onDone: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    const parsed = validate(partnerFormSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setFormError(null);
    running.current = true;
    setBusy(true);
    try {
      if (partner) await clientApi.contentUpdatePartner(partner.id, parsed.data);
      else await clientApi.contentCreatePartner(parsed.data);
      onDone();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
      <FormError message={formError} />
      <Select label="Type" name="type" defaultValue={partner?.type ?? 'partner'} error={errors.type}>
        <option value="partner">Partenaire</option>
        <option value="client">Client</option>
      </Select>
      <Input label="Nom" name="name" defaultValue={partner?.name} maxLength={120} required error={errors.name} />
      <Input label="Site web" name="website_url" type="url" defaultValue={partner?.website_url ?? ''} placeholder="https://" error={errors.website_url} />
      <Textarea label="Description" name="description" defaultValue={partner?.description ?? ''} rows={3} maxLength={500} error={errors.description} />
      <Input label="Ordre d’affichage" name="sort_order" type="number" min={0} defaultValue={partner?.sort_order ?? 0} error={errors.sort_order} />
      <Checkbox name="is_visible" label="Visible sur le site" defaultChecked={partner?.is_visible ?? true} />
      <div><Button type="submit" loading={busy}>Enregistrer</Button></div>
    </form>
  );
}
