'use client';

import type { ReactNode } from 'react';
import type { ReferenceData } from '@/lib/api/types';
import {
  normalizePhone,
  type EstablishmentDraft,
  type StepId,
} from '@/lib/establishment-schemas';
import { DOCUMENT_RULES, formatBytes, MAX_DOCUMENTS } from '@/lib/files';
import { DOCUMENT_TYPE_LABELS, POSITIONS, SUBMITTER_LABELS, TYPE_LABELS } from '@/lib/labels';
import { formatFcfa } from '@/lib/format';
import type { DocumentType } from '@/lib/api/types';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FileInput } from '../ui/FileInput';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ExecutivesEditor } from './ExecutivesEditor';
import { CheckboxGroup, RadioGroup } from './GroupControls';
import { LocationFields } from './LocationFields';

export interface StepProps {
  draft: EstablishmentDraft;
  set: (patch: Partial<EstablishmentDraft>) => void;
  errors: Record<string, string>;
  reference: ReferenceData;
  disabled?: boolean;
}

type TextField = Exclude<
  {
    [K in keyof EstablishmentDraft]: EstablishmentDraft[K] extends string ? K : never;
  }[keyof EstablishmentDraft],
  never
>;

/** Props communes d'un champ texte lié au brouillon (id stable pour le résumé d'erreurs). */
function bind(p: StepProps, name: TextField) {
  return {
    id: `f-${name}`,
    value: p.draft[name],
    error: p.errors[name],
    disabled: p.disabled,
    onChange: (e: { target: { value: string } }) => p.set({ [name]: e.target.value }),
  };
}

function TypeStep(p: StepProps) {
  return (
    <RadioGroup
      id="f-type"
      name="establishment-type"
      legend="Quel type d’établissement souhaitez-vous inscrire ?"
      required
      value={p.draft.type}
      onChange={(type) => p.set({ type })}
      error={p.errors.type}
      options={[
        {
          value: 'provider',
          label: TYPE_LABELS.provider,
          hint: 'Entreprise de sécurité, centre de formation, vendeur de matériel, association.',
        },
        {
          value: 'state_force',
          label: TYPE_LABELS.state_force,
          hint: 'Police, gendarmerie, sapeurs-pompiers et autres structures de l’État.',
        },
      ]}
    />
  );
}

function DeclarantStep(p: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        id="f-submitter_role"
        name="submitter-role"
        legend="Quelle est votre qualité ?"
        required
        value={p.draft.submitter_role}
        onChange={(submitter_role) => p.set({ submitter_role })}
        error={p.errors.submitter_role}
        options={(Object.keys(SUBMITTER_LABELS) as (keyof typeof SUBMITTER_LABELS)[]).map((v) => ({
          value: v,
          label: SUBMITTER_LABELS[v],
        }))}
      />
      <Checkbox
        id="f-is_in_service"
        label="L’établissement est actuellement en service"
        checked={p.draft.is_in_service}
        onChange={(e) => p.set({ is_in_service: e.target.checked })}
      />
    </div>
  );
}

function IdentityStep(p: StepProps) {
  const force = p.draft.type === 'state_force';
  return (
    <div className="flex flex-col gap-4">
      <Input
        {...bind(p, 'name')}
        label={force ? 'Nom de la structure' : 'Raison sociale'}
        required
        maxLength={255}
        autoComplete="organization"
      />
      {force ? (
        <>
          <Select {...bind(p, 'force_type_id')} label="Type de structure" required>
            <option value="">Choisir un type…</option>
            {p.reference.state_force_types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <CheckboxGroup
            id="f-procedure_type_ids"
            legend="Démarches possibles dans cette structure"
            hint="Facultatif."
            options={p.reference.procedure_types.map((t) => ({ value: t.id, label: t.name }))}
            selected={p.draft.procedure_type_ids}
            onChange={(procedure_type_ids) => p.set({ procedure_type_ids })}
            error={p.errors.procedure_type_ids}
            disabled={p.disabled}
          />
        </>
      ) : (
        <>
          <CheckboxGroup
            id="f-company_type_ids"
            legend="Type d’entreprise"
            required
            options={p.reference.company_types.map((t) => ({ value: t.id, label: t.name }))}
            selected={p.draft.company_type_ids}
            onChange={(company_type_ids) => p.set({ company_type_ids })}
            error={p.errors.company_type_ids}
            disabled={p.disabled}
          />
          <CheckboxGroup
            id="f-service_type_ids"
            legend="Services proposés"
            required
            options={p.reference.service_types.map((t) => ({ value: t.id, label: t.name }))}
            selected={p.draft.service_type_ids}
            onChange={(service_type_ids) => p.set({ service_type_ids })}
            error={p.errors.service_type_ids}
            disabled={p.disabled}
          />
        </>
      )}
      <Textarea
        {...bind(p, 'description')}
        label="Description"
        hint="Présentez l’établissement en quelques phrases."
        rows={5}
        maxLength={5000}
      />
    </div>
  );
}

function LocationStep(p: StepProps) {
  return (
    <LocationFields
      values={p.draft}
      onChange={(patch) => p.set(patch)}
      errors={p.errors}
      reference={p.reference}
      disabled={p.disabled}
    />
  );
}

function LegalStep(p: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-md bg-surface-alt p-3 text-sm text-muted">
        Ces informations légales sont utilisées pour la vérification par notre équipe. Elles ne
        sont pas affichées publiquement sans nécessité.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input {...bind(p, 'rccm')} label="Numéro RCCM" maxLength={50} />
        <Input {...bind(p, 'legal_form')} label="Forme juridique" hint="Par exemple SARL, SA, SAS." maxLength={100} />
        <Input
          {...bind(p, 'share_capital')}
          label="Capital social (FCFA)"
          inputMode="numeric"
        />
        <Input {...bind(p, 'approval_number')} label="Numéro d’agrément" maxLength={50} />
        <Input
          {...bind(p, 'approval_expires_at')}
          label="Date d’expiration de l’agrément"
          type="date"
        />
      </div>
      <Textarea {...bind(p, 'corporate_purpose')} label="Objet social" rows={3} maxLength={1000} />
      <section aria-labelledby="executives-title" className="flex flex-col gap-3">
        <h3 id="executives-title" className="text-lg font-semibold">
          Dirigeants
        </h3>
        <ExecutivesEditor
          value={p.draft.executives}
          onChange={(executives) => p.set({ executives })}
          errors={p.errors}
          disabled={p.disabled}
        />
      </section>
    </div>
  );
}

function ContactsStep(p: StepProps) {
  const force = p.draft.type === 'state_force';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          {...bind(p, 'phone')}
          label="Téléphone"
          type="tel"
          required={!force}
          autoComplete="tel"
          hint="Exemple : +225 07 09 44 51 11 ou 0709445111."
        />
        <Input {...bind(p, 'phone_alt')} label="Second téléphone" type="tel" />
        <Input {...bind(p, 'emergency_phone')} label="Numéro d’urgence" type="tel" />
        <Input {...bind(p, 'email')} label="Adresse e-mail publique" type="email" maxLength={255} />
      </div>
      {force ? (
        <>
          <Input
            {...bind(p, 'opening_hours')}
            label="Horaires d’ouverture"
            hint="Par exemple : lundi au vendredi, 8 h - 17 h."
            maxLength={255}
          />
          <Checkbox
            id="f-is_open_24h"
            label="Ouvert 24 h sur 24"
            checked={p.draft.is_open_24h}
            onChange={(e) => p.set({ is_open_24h: e.target.checked })}
          />
        </>
      ) : (
        <>
          <Input {...bind(p, 'whatsapp_number')} label="Numéro WhatsApp" type="tel" />
          <Input {...bind(p, 'website_url')} label="Site web" type="url" hint="Commence par https://" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input {...bind(p, 'facebook_url')} label="Page Facebook" type="url" />
            <Input {...bind(p, 'instagram_url')} label="Compte Instagram" type="url" />
            <Input {...bind(p, 'twitter_url')} label="Compte X (Twitter)" type="url" />
            <Input {...bind(p, 'linkedin_url')} label="Page LinkedIn" type="url" />
          </div>
          <Input
            {...bind(p, 'price_from')}
            label="Tarif de départ (FCFA)"
            inputMode="numeric"
            hint="Facultatif."
          />
        </>
      )}
    </div>
  );
}

function DocumentsStep(p: StepProps) {
  const [docType, setDocType] = useState<DocumentType>('rccm_extract');
  const [fileError, setFileError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const full = p.draft.documents.length >= MAX_DOCUMENTS;
  const listError = Object.entries(p.errors).find(([k]) => k.startsWith('documents'))?.[1];

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-surface-alt p-3 text-sm text-muted">
        Les justificatifs (agrément, extrait du RCCM, pièce d’identité…) servent uniquement à la
        vérification par notre équipe. Ils sont stockés de façon privée et ne sont jamais publiés.
        Cette étape est facultative : vous pourrez aussi les ajouter plus tard depuis votre espace
        prestataire. Ils ne sont envoyés qu’à la fin, après la création de la fiche.
      </p>
      <Select
        id="f-documents"
        label="Type de document"
        value={docType}
        onChange={(e) => setDocType(e.target.value as DocumentType)}
        disabled={p.disabled || full}
      >
        {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
          <option key={t} value={t}>
            {DOCUMENT_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <FileInput
        label="Fichier à ajouter"
        rules={DOCUMENT_RULES}
        hint={`${DOCUMENT_RULES.typesLabel}, ${formatBytes(DOCUMENT_RULES.maxBytes)} maximum, ${MAX_DOCUMENTS} fichiers au plus.`}
        error={fileError ?? listError}
        disabled={p.disabled || full}
        resetKey={resetKey}
        onChange={(file, error) => {
          setFileError(error);
          if (file) {
            p.set({ documents: [...p.draft.documents, { file, type: docType }] });
            setResetKey((k) => k + 1);
          }
        }}
      />
      {p.draft.documents.length > 0 ? (
        <ul aria-label="Justificatifs à envoyer" className="flex flex-col gap-2">
          {p.draft.documents.map((d, i) => (
            <li
              key={`${d.file.name}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3"
            >
              <span>
                <span className="font-medium">{d.file.name}</span>
                <span className="block text-sm text-muted">
                  {DOCUMENT_TYPE_LABELS[d.type]} · {formatBytes(d.file.size)}
                </span>
              </span>
              <Button
                variant="ghost"
                aria-label={`Retirer le fichier ${d.file.name}`}
                disabled={p.disabled}
                onClick={() => p.set({ documents: p.draft.documents.filter((_, k) => k !== i) })}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Aucun justificatif ajouté.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="font-semibold">{label}</dt>
      <dd className="break-words sm:col-span-2">{children}</dd>
    </div>
  );
}

function names(list: { id: number; name: string }[], ids: number[]): string {
  return list
    .filter((o) => ids.includes(o.id))
    .map((o) => o.name)
    .join(', ');
}

function ReviewStep(p: StepProps) {
  const d = p.draft;
  const force = d.type === 'state_force';
  const city = p.reference.cities.find((c) => String(c.id) === d.city_id);
  const district = city?.districts.find((x) => String(x.id) === d.district_id);
  const ph = (v: string) => (v.trim() ? normalizePhone(v) : '');
  return (
    <div className="flex flex-col gap-5">
      <dl className="divide-y divide-line rounded-lg border border-line px-4">
        <Row label="Type">{d.type ? TYPE_LABELS[d.type] : ''}</Row>
        <Row label="Votre qualité">{d.submitter_role ? SUBMITTER_LABELS[d.submitter_role] : ''}</Row>
        <Row label="En service">{d.is_in_service ? 'Oui' : 'Non'}</Row>
        <Row label={force ? 'Nom de la structure' : 'Raison sociale'}>{d.name}</Row>
        {force ? (
          <>
            <Row label="Type de structure">
              {p.reference.state_force_types.find((t) => String(t.id) === d.force_type_id)?.name}
            </Row>
            <Row label="Démarches">{names(p.reference.procedure_types, d.procedure_type_ids)}</Row>
          </>
        ) : (
          <>
            <Row label="Types d’entreprise">{names(p.reference.company_types, d.company_type_ids)}</Row>
            <Row label="Services">{names(p.reference.service_types, d.service_type_ids)}</Row>
          </>
        )}
        <Row label="Description">{d.description}</Row>
        <Row label="Ville">{city?.name}</Row>
        <Row label="Quartier">{district?.name}</Row>
        <Row label="Adresse">{d.address}</Row>
        <Row label="Repères">{d.geo_description}</Row>
        <Row label="Position sur la carte">{d.lat && d.lng ? `${d.lat} ; ${d.lng}` : ''}</Row>
        {!force ? (
          <>
            <Row label="Numéro RCCM">{d.rccm}</Row>
            <Row label="Forme juridique">{d.legal_form}</Row>
            <Row label="Capital social">{d.share_capital ? formatFcfa(Number(d.share_capital)) : ''}</Row>
            <Row label="Objet social">{d.corporate_purpose}</Row>
            <Row label="Numéro d’agrément">{d.approval_number}</Row>
            <Row label="Expiration de l’agrément">{d.approval_expires_at}</Row>
            <Row label="Dirigeants">
              {d.executives.length ? (
                <ul>
                  {d.executives.map((e, i) => (
                    <li key={i}>
                      {e.full_name} ({e.position === 'other' ? e.position_label : POSITIONS[e.position]}
                      ) : {e.is_visible ? 'visible publiquement' : 'non visible publiquement'}
                    </li>
                  ))}
                </ul>
              ) : (
                ''
              )}
            </Row>
          </>
        ) : null}
        <Row label="Téléphone">{ph(d.phone)}</Row>
        <Row label="Second téléphone">{ph(d.phone_alt)}</Row>
        <Row label="Numéro d’urgence">{ph(d.emergency_phone)}</Row>
        <Row label="E-mail">{d.email}</Row>
        {force ? (
          <>
            <Row label="Horaires">{d.is_open_24h ? 'Ouvert 24 h sur 24' : d.opening_hours}</Row>
          </>
        ) : (
          <>
            <Row label="WhatsApp">{ph(d.whatsapp_number)}</Row>
            <Row label="Site web">{d.website_url}</Row>
            <Row label="Facebook">{d.facebook_url}</Row>
            <Row label="Instagram">{d.instagram_url}</Row>
            <Row label="X (Twitter)">{d.twitter_url}</Row>
            <Row label="LinkedIn">{d.linkedin_url}</Row>
            <Row label="Tarif de départ">{d.price_from ? formatFcfa(Number(d.price_from)) : ''}</Row>
          </>
        )}
        <Row label="Justificatifs">
          {d.documents.length
            ? d.documents.map((x) => `${x.file.name} (${DOCUMENT_TYPE_LABELS[x.type]})`).join(', ')
            : 'Aucun'}
        </Row>
      </dl>
      <Checkbox
        id="f-consent"
        label="J’atteste que ces informations sont exactes et j’accepte que ProtectIci les traite pour valider et publier cette fiche."
        checked={d.consent}
        onChange={(e) => p.set({ consent: e.target.checked })}
        error={p.errors.consent}
        disabled={p.disabled}
      />
    </div>
  );
}

export function StepContent({ step, ...p }: StepProps & { step: StepId }) {
  switch (step) {
    case 'type':
      return <TypeStep {...p} />;
    case 'declarant':
      return <DeclarantStep {...p} />;
    case 'identity':
      return <IdentityStep {...p} />;
    case 'location':
      return <LocationStep {...p} />;
    case 'legal':
      return <LegalStep {...p} />;
    case 'contacts':
      return <ContactsStep {...p} />;
    case 'documents':
      return <DocumentsStep {...p} />;
    case 'review':
      return <ReviewStep {...p} />;
  }
}
