'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminEstablishment, ExecutivePosition, Option, ReferenceData } from '@/lib/api/types';
import {
  buildCreateInput,
  emptyDraft,
  validateStep,
  type EstablishmentDraft,
  type StepId,
} from '@/lib/establishment-schemas';
import { POSITIONS } from '@/lib/labels';
import { useAsyncAction } from '@/lib/use-async';
import { LocationFields } from '../../establishment/LocationFields';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { FormError, FieldError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Fiche existante → brouillon de formulaire (chaînes), pour réutiliser validation et conversions. */
export function toDraft(e: AdminEstablishment): EstablishmentDraft {
  return {
    ...emptyDraft(),
    type: e.type,
    submitter_role: e.submitter_role ?? '',
    is_in_service: e.is_in_service,
    name: e.name,
    description: text(e.description),
    company_type_ids: e.company_type_ids ?? [],
    service_type_ids: e.service_type_ids ?? [],
    force_type_id: text(e.force_type_id),
    procedure_type_ids: e.procedure_type_ids ?? [],
    city_id: text(e.city_id),
    district_id: text(e.district_id),
    address: text(e.address),
    geo_description: text(e.geo_description),
    plus_code: text(e.plus_code),
    lat: text(e.lat),
    lng: text(e.lng),
    rccm: text(e.rccm),
    legal_form: text(e.legal_form),
    share_capital: text(e.share_capital),
    corporate_purpose: text(e.corporate_purpose),
    approval_number: text(e.approval_number),
    approval_expires_at: text(e.approval_expires_at).slice(0, 10),
    executives: e.executives.map((x) => ({
      full_name: x.full_name,
      position: x.position,
      position_label: text(x.position_label),
      is_visible: x.is_visible,
    })),
    phone: text(e.phone),
    phone_alt: text(e.phone_alt),
    emergency_phone: text(e.emergency_phone),
    email: text(e.email),
    website_url: text(e.website_url),
    facebook_url: text(e.facebook_url),
    instagram_url: text(e.instagram_url),
    twitter_url: text(e.twitter_url),
    linkedin_url: text(e.linkedin_url),
    whatsapp_number: text(e.whatsapp_number),
    price_from: text(e.price_from),
    opening_hours: text(e.opening_hours),
    is_open_24h: e.is_open_24h ?? false,
  };
}

function payload(d: EstablishmentDraft): Record<string, unknown> {
  const { type: _type, consent: _consent, submitter_role: _role, ...rest } = buildCreateInput(
    d,
  ) as unknown as Record<string, unknown>;
  void _type;
  void _consent;
  void _role;
  return rest;
}

const LIST_FIELDS = new Set(['executives', 'procedure_type_ids']);

/**
 * Ne retient que les champs modifiés. Un champ vidé est envoyé à `null` (ou `[]` pour une liste),
 * pour que l'API distingue « effacé » de « inchangé ».
 */
export function computePatch(
  initial: EstablishmentDraft,
  current: EstablishmentDraft,
  featured: { initial: boolean; current: boolean },
): Record<string, unknown> {
  const a = payload(initial);
  const b = payload(current);
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null)) continue;
    patch[key] = b[key] ?? (LIST_FIELDS.has(key) ? [] : null);
  }
  if (featured.initial !== featured.current) patch.is_featured = featured.current;
  return patch;
}

function CheckGroup({
  legend,
  options,
  selected,
  onChange,
  error,
  idPrefix,
}: {
  legend: string;
  options: Option[];
  selected: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  idPrefix: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-semibold">{legend}</legend>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {options.map((o) => (
          <Checkbox
            key={o.id}
            id={`${idPrefix}-${o.id}`}
            label={o.name}
            checked={selected.includes(o.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...selected, o.id] : selected.filter((i) => i !== o.id))
            }
          />
        ))}
      </div>
      <FieldError id={`${idPrefix}-error`} message={error} />
    </fieldset>
  );
}

const STEPS_PROVIDER: StepId[] = ['identity', 'location', 'legal', 'contacts'];
const STEPS_FORCE: StepId[] = ['identity', 'location', 'contacts'];

export function AdminEstablishmentEditForm({
  establishment,
  reference,
  onSaved,
  onCancel,
}: {
  establishment: AdminEstablishment;
  reference: ReferenceData;
  onSaved: (e: AdminEstablishment) => void;
  onCancel: () => void;
}) {
  const [initial] = useState(() => toDraft(establishment));
  const [draft, setDraft] = useState<EstablishmentDraft>(initial);
  const [featured, setFeatured] = useState(establishment.is_featured);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<string | null>(null);
  const action = useAsyncAction();
  const isProvider = establishment.type === 'provider';

  const set = (patch: Partial<EstablishmentDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const str = (key: keyof EstablishmentDraft) => ({
    value: draft[key] as string,
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }),
    error: errors[key],
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    const found: Record<string, string> = {};
    for (const step of isProvider ? STEPS_PROVIDER : STEPS_FORCE) {
      const r = validateStep(step, draft);
      if (!r.ok) Object.assign(found, r.errors);
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const patch = computePatch(initial, draft, { initial: establishment.is_featured, current: featured });
    if (Object.keys(patch).length === 0) {
      setInfo('Aucune modification à enregistrer.');
      return;
    }
    const res = await action.run(() =>
      clientApi.adminUpdateEstablishment(establishment.type, establishment.id, patch),
    );
    if (res.ok) onSaved(res.value);
  }

  const apiErrors = action.error ? action.error.fields : {};
  const err = (key: string) => errors[key] ?? apiErrors[key];

  function setExecutive(i: number, patch: Partial<EstablishmentDraft['executives'][number]>) {
    set({ executives: draft.executives.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-label="Modifier la fiche">
      <Card as="fieldset" className="flex flex-col gap-4">
        <legend className="px-1 text-lg font-bold">Identité</legend>
        <Input label={isProvider ? 'Raison sociale' : 'Nom de la structure'} required {...str('name')} error={err('name')} />
        {isProvider ? (
          <>
            <CheckGroup
              idPrefix="company"
              legend="Types d’entreprise *"
              options={reference.company_types}
              selected={draft.company_type_ids}
              onChange={(ids) => set({ company_type_ids: ids })}
              error={err('company_type_ids')}
            />
            <CheckGroup
              idPrefix="service"
              legend="Services *"
              options={reference.service_types}
              selected={draft.service_type_ids}
              onChange={(ids) => set({ service_type_ids: ids })}
              error={err('service_type_ids')}
            />
            <Checkbox
              label="En service"
              checked={draft.is_in_service}
              onChange={(e) => set({ is_in_service: e.target.checked })}
            />
          </>
        ) : (
          <>
            <Select
              label="Type de structure"
              required
              value={draft.force_type_id}
              onChange={(e) => set({ force_type_id: e.target.value })}
              error={err('force_type_id')}
            >
              <option value="">Choisir un type…</option>
              {reference.state_force_types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <CheckGroup
              idPrefix="procedure"
              legend="Démarches proposées"
              options={reference.procedure_types}
              selected={draft.procedure_type_ids}
              onChange={(ids) => set({ procedure_type_ids: ids })}
              error={err('procedure_type_ids')}
            />
          </>
        )}
        <Textarea label="Description" rows={5} maxLength={5000} {...str('description')} error={err('description')} />
      </Card>

      <Card as="fieldset" className="flex flex-col gap-4">
        <legend className="px-1 text-lg font-bold">Localisation</legend>
        <LocationFields
          values={{
            city_id: draft.city_id,
            district_id: draft.district_id,
            address: draft.address,
            geo_description: draft.geo_description,
            plus_code: draft.plus_code,
            lat: draft.lat,
            lng: draft.lng,
          }}
          onChange={set}
          errors={{ ...apiErrors, ...errors }}
          reference={reference}
          disabled={action.busy}
        />
      </Card>

      {isProvider ? (
        <Card as="fieldset" className="flex flex-col gap-4">
          <legend className="px-1 text-lg font-bold">Informations légales</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Numéro RCCM" {...str('rccm')} error={err('rccm')} />
            <Input label="Forme juridique" {...str('legal_form')} error={err('legal_form')} />
            <Input
              label="Capital social (FCFA)"
              inputMode="numeric"
              {...str('share_capital')}
              error={err('share_capital')}
            />
            <Input label="Numéro d’agrément" {...str('approval_number')} error={err('approval_number')} />
            <Input
              label="Fin de validité de l’agrément"
              type="date"
              {...str('approval_expires_at')}
              error={err('approval_expires_at')}
            />
          </div>
          <Textarea label="Objet social" rows={3} maxLength={1000} {...str('corporate_purpose')} error={err('corporate_purpose')} />

          <fieldset className="flex flex-col gap-3">
            <legend className="font-semibold">Dirigeants</legend>
            <FieldError id="executives-error" message={err('executives')} />
            {draft.executives.map((x, i) => (
              <div key={i} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2">
                <Input
                  label={`Nom du dirigeant ${i + 1}`}
                  required
                  value={x.full_name}
                  onChange={(e) => setExecutive(i, { full_name: e.target.value })}
                  error={err(`executives.${i}.full_name`)}
                />
                <Select
                  label={`Fonction du dirigeant ${i + 1}`}
                  value={x.position}
                  onChange={(e) => setExecutive(i, { position: e.target.value as ExecutivePosition })}
                  error={err(`executives.${i}.position`)}
                >
                  {(Object.keys(POSITIONS) as ExecutivePosition[]).map((p) => (
                    <option key={p} value={p}>
                      {POSITIONS[p]}
                    </option>
                  ))}
                </Select>
                {x.position === 'other' ? (
                  <Input
                    label={`Précision de la fonction ${i + 1}`}
                    value={x.position_label}
                    onChange={(e) => setExecutive(i, { position_label: e.target.value })}
                    error={err(`executives.${i}.position_label`)}
                  />
                ) : null}
                <Checkbox
                  label="Visible sur la fiche publique"
                  checked={x.is_visible}
                  onChange={(e) => setExecutive(i, { is_visible: e.target.checked })}
                />
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => set({ executives: draft.executives.filter((_, idx) => idx !== i) })}
                  >
                    Retirer le dirigeant {i + 1}
                  </Button>
                </div>
              </div>
            ))}
            {draft.executives.length < 10 ? (
              <div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({
                      executives: [
                        ...draft.executives,
                        { full_name: '', position: 'general_manager', position_label: '', is_visible: true },
                      ],
                    })
                  }
                >
                  Ajouter un dirigeant
                </Button>
              </div>
            ) : null}
          </fieldset>
        </Card>
      ) : null}

      <Card as="fieldset" className="flex flex-col gap-4">
        <legend className="px-1 text-lg font-bold">Contacts</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Téléphone" type="tel" required={isProvider} {...str('phone')} error={err('phone')} />
          <Input label="Second téléphone" type="tel" {...str('phone_alt')} error={err('phone_alt')} />
          <Input label="Téléphone d’urgence" type="tel" {...str('emergency_phone')} error={err('emergency_phone')} />
          <Input label="Adresse e-mail" type="email" {...str('email')} error={err('email')} />
          {isProvider ? (
            <>
              <Input label="Site web" type="url" {...str('website_url')} error={err('website_url')} />
              <Input label="Facebook" type="url" {...str('facebook_url')} error={err('facebook_url')} />
              <Input label="Instagram" type="url" {...str('instagram_url')} error={err('instagram_url')} />
              <Input label="X (Twitter)" type="url" {...str('twitter_url')} error={err('twitter_url')} />
              <Input label="LinkedIn" type="url" {...str('linkedin_url')} error={err('linkedin_url')} />
              <Input label="Numéro WhatsApp" type="tel" {...str('whatsapp_number')} error={err('whatsapp_number')} />
              <Input
                label="Tarif de départ (FCFA)"
                inputMode="numeric"
                {...str('price_from')}
                error={err('price_from')}
              />
            </>
          ) : (
            <>
              <Input label="Horaires" {...str('opening_hours')} error={err('opening_hours')} />
              <Checkbox
                label="Ouvert 24 h/24"
                checked={draft.is_open_24h}
                onChange={(e) => set({ is_open_24h: e.target.checked })}
              />
            </>
          )}
        </div>
      </Card>

      <Card as="fieldset" className="flex flex-col gap-2">
        <legend className="px-1 text-lg font-bold">Publication</legend>
        <Checkbox
          label="Mettre cette fiche en avant"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
        />
      </Card>

      <FormError message={action.error?.form} />
      <p role="status" aria-live="polite" className="text-muted">
        {info}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={action.busy}>
          Enregistrer les modifications
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.busy}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
