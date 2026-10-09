'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { validateStep, type EstablishmentDraft } from '@/lib/establishment-schemas';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { Textarea } from '../ui/Textarea';
import { ErrorSummary } from './ErrorSummary';
import { CheckboxGroup } from './GroupControls';
import { LocationFields } from './LocationFields';
import { buildInfoPatch, toDraft } from './manager-utils';
import type { TabProps } from './manager-types';

export function InfoTab({ est, reference, readOnly, onSaved }: TabProps) {
  const [draft, setDraft] = useState<EstablishmentDraft>(() => toDraft(est));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signal, setSignal] = useState(0);
  const { run, busy } = useAsyncAction();
  const toast = useToast();
  const force = est.type === 'state_force';
  const errors = { ...apiErrors, ...localErrors };

  const set = (patch: Partial<EstablishmentDraft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const text = (name: keyof EstablishmentDraft) => ({
    value: draft[name] as string,
    error: errors[name],
    disabled: readOnly || busy,
    onChange: (e: { target: { value: string } }) => set({ [name]: e.target.value }),
  });

  async function submit() {
    // Le nom (champ sensible) n'est pas modifiable ici : il sert seulement à valider le schéma.
    const found: Record<string, string> = {};
    for (const step of ['identity', 'location', 'contacts'] as const) {
      const res = validateStep(step, draft);
      if (!res.ok) Object.assign(found, res.errors);
    }
    setApiErrors({});
    setFormError(null);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) {
      setSignal((n) => n + 1);
      return;
    }
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.updateMyEstablishment(est.type, est.slug, buildInfoPatch(draft));
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      onSaved(result.value);
      setSaved(true);
      toast.show('Informations enregistrées.', 'success');
    } else if (caught !== null) {
      const d = describeError(caught);
      setApiErrors(d.fields);
      setFormError(d.form);
      setSignal((n) => n + 1);
    }
  }

  const summary = { ...errors };

  return (
    <form
      className="flex max-w-3xl flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="rounded-md bg-surface-alt p-3 text-sm text-muted">
        {force
          ? 'Le nom et le type de structure ne se modifient pas ici : utilisez l’onglet « Modifications sensibles ».'
          : 'La raison sociale et les informations légales ne se modifient pas ici : utilisez l’onglet « Modifications sensibles ».'}
      </p>
      <ErrorSummary errors={summary} focusSignal={signal} />
      <FormError message={formError} />
      <FormSuccess message={saved ? 'Vos modifications ont été enregistrées.' : null} />

      <Textarea label="Description" rows={5} maxLength={5000} {...text('description')} />
      <Checkbox
        label="L’établissement est actuellement en service"
        checked={draft.is_in_service}
        disabled={readOnly || busy}
        onChange={(e) => set({ is_in_service: e.target.checked })}
      />

      {force ? (
        <CheckboxGroup
          id="info-procedures"
          legend="Démarches possibles"
          options={reference.procedure_types.map((t) => ({ value: t.id, label: t.name }))}
          selected={draft.procedure_type_ids}
          onChange={(procedure_type_ids) => set({ procedure_type_ids })}
          error={errors.procedure_type_ids}
          disabled={readOnly || busy}
        />
      ) : (
        <>
          <CheckboxGroup
            id="info-company-types"
            legend="Type d’entreprise"
            required
            options={reference.company_types.map((t) => ({ value: t.id, label: t.name }))}
            selected={draft.company_type_ids}
            onChange={(company_type_ids) => set({ company_type_ids })}
            error={errors.company_type_ids}
            disabled={readOnly || busy}
          />
          <CheckboxGroup
            id="info-service-types"
            legend="Services proposés"
            required
            options={reference.service_types.map((t) => ({ value: t.id, label: t.name }))}
            selected={draft.service_type_ids}
            onChange={(service_type_ids) => set({ service_type_ids })}
            error={errors.service_type_ids}
            disabled={readOnly || busy}
          />
        </>
      )}

      <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4" disabled={readOnly || busy}>
        <legend className="px-1 text-lg font-semibold">Contacts</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Téléphone" type="tel" required={!force} {...text('phone')} />
          <Input label="Second téléphone" type="tel" {...text('phone_alt')} />
          <Input label="Numéro d’urgence" type="tel" {...text('emergency_phone')} />
          <Input label="Adresse e-mail publique" type="email" maxLength={255} {...text('email')} />
        </div>
        {force ? (
          <>
            <Input label="Horaires d’ouverture" maxLength={255} {...text('opening_hours')} />
            <Checkbox
              label="Ouvert 24 h sur 24"
              checked={draft.is_open_24h}
              onChange={(e) => set({ is_open_24h: e.target.checked })}
            />
          </>
        ) : (
          <>
            <Input label="Numéro WhatsApp" type="tel" {...text('whatsapp_number')} />
            <Input label="Site web" type="url" {...text('website_url')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Page Facebook" type="url" {...text('facebook_url')} />
              <Input label="Compte Instagram" type="url" {...text('instagram_url')} />
              <Input label="Compte X (Twitter)" type="url" {...text('twitter_url')} />
              <Input label="Page LinkedIn" type="url" {...text('linkedin_url')} />
            </div>
            <Input label="Tarif de départ (FCFA)" inputMode="numeric" {...text('price_from')} />
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4" disabled={readOnly || busy}>
        <legend className="px-1 text-lg font-semibold">Adresse et position</legend>
        <LocationFields
          values={draft}
          onChange={(patch) => set(patch)}
          errors={errors}
          reference={reference}
          disabled={readOnly || busy}
        />
      </fieldset>

      {readOnly ? null : (
        <div>
          <Button type="submit" loading={busy}>
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </form>
  );
}
