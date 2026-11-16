'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  CLAIM_DOCUMENT_RULES,
  CLAIM_MESSAGE_MAX,
  claimsApi,
  establishmentPublicPath,
  type MyClaim,
} from '@/lib/api/claims';
import { ApiError, describeError } from '@/lib/api/errors';
import type { EstablishmentType, SubmitterRole } from '@/lib/api/types';
import { normalizePhone } from '@/lib/establishment-schemas';
import { formatBytes } from '@/lib/files';
import { SUBMITTER_LABELS } from '@/lib/labels';
import { useAsyncAction } from '@/lib/use-async';
import { RadioGroup } from '../feedback/RadioGroup';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { FormError } from '../ui/Field';
import { LoadingBlock } from '../ui/Spinner';
import { FileInput } from '../ui/FileInput';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

const E164 = /^\+[1-9]\d{7,14}$/;
const FIELD_ORDER = ['submitter_role', 'phone', 'message', 'document', 'consent'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export const CLAIM_RATE_LIMIT_MESSAGE =
  'Vous avez atteint la limite de demandes de revendication pour aujourd’hui. Réessayez demain.';

/** Message affiché pour un échec d'envoi (409 et 429 explicites, jamais de détail technique). */
function claimErrorMessage(e: unknown, fallback: string | null): string | null {
  if (e instanceof ApiError && e.status === 409) {
    return e.message && e.message !== '' ? e.message : 'Cette fiche ne peut pas être revendiquée.';
  }
  if (e instanceof ApiError && e.status === 429) return CLAIM_RATE_LIMIT_MESSAGE;
  if (e instanceof ApiError && e.status === 404) {
    return 'Cette fiche est introuvable ou n’est plus publiée.';
  }
  return fallback;
}

/** Formulaire de revendication d'une fiche (contrat §10.3) : multipart, CSRF géré par le client. */
export function ClaimForm({
  type,
  slug,
  name,
}: {
  type: EstablishmentType;
  slug: string;
  name: string;
}) {
  const [role, setRole] = useState<SubmitterRole | ''>('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<MyClaim | null>(null);
  // Demande existante pour cette fiche (R27) : `undefined` tant que /me/claims n'a pas répondu.
  const [existing, setExisting] = useState<MyClaim | null | undefined>(undefined);
  const { run, busy } = useAsyncAction();
  const focusField = useRef<FieldName | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const f = focusField.current;
    focusField.current = null;
    if (!f) return;
    const el =
      f === 'submitter_role'
        ? document.querySelector<HTMLInputElement>('input[name="claim-submitter-role"]')
        : document.getElementById(`claim-${f}`);
    el?.focus();
  });

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  useEffect(() => {
    let active = true;
    claimsApi
      .listMyClaims()
      .then((claims) => {
        if (!active) return;
        const mine = claims.find(
          (c) =>
            c.establishment.type === type &&
            c.establishment.slug === slug &&
            (c.status === 'pending' || c.status === 'approved'),
        );
        setExisting(mine ?? null);
      })
      // En cas d'échec, on affiche le formulaire : l'API refusera un doublon (409).
      .catch(() => active && setExisting(null));
    return () => {
      active = false;
    };
  }, [type, slug]);

  function validateLocal(): Partial<Record<FieldName, string>> {
    const out: Partial<Record<FieldName, string>> = {};
    if (!role) out.submitter_role = 'Indiquez votre qualité.';
    if (!phone.trim()) out.phone = 'Le numéro de téléphone est obligatoire.';
    else if (!E164.test(normalizePhone(phone))) {
      out.phone = 'Numéro invalide. Exemple : +225 07 09 44 51 11 ou 0709445111.';
    }
    if (message.trim().length > CLAIM_MESSAGE_MAX) {
      out.message = `Le message est trop long (${CLAIM_MESSAGE_MAX} caractères maximum).`;
    }
    if (!file) out.document = errors.document ?? 'Joignez un justificatif.';
    if (!consent) out.consent = 'Vous devez cocher cette case pour envoyer votre demande.';
    return out;
  }

  function showErrors(next: Partial<Record<FieldName, string>>) {
    setErrors(next);
    focusField.current = FIELD_ORDER.find((k) => next[k]) ?? null;
  }

  async function submit() {
    setFormError(null);
    const local = validateLocal();
    if (Object.keys(local).length > 0) {
      showErrors(local);
      return;
    }
    setErrors({});
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await claimsApi.submitClaim(type, slug, {
          submitter_role: role as SubmitterRole,
          phone,
          message: message.trim() || undefined,
          document: file as File,
          consent,
        });
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      setDone(result.value);
      return;
    }
    if (caught === null) return;
    const d = describeError(caught);
    const fields: Partial<Record<FieldName, string>> = {};
    for (const k of FIELD_ORDER) if (d.fields[k]) fields[k] = d.fields[k];
    if (Object.keys(fields).length > 0) {
      showErrors(fields);
      const others = Object.keys(d.fields).filter(
        (k) => !(FIELD_ORDER as readonly string[]).includes(k),
      );
      setFormError(others.length ? d.fields[others[0]!]! : null);
    } else {
      setFormError(claimErrorMessage(caught, d.form));
    }
  }

  if (done) {
    return (
      <Card className="max-w-[44rem] bg-c4 p-5 sm:p-8">
        <h2 ref={doneRef} tabIndex={-1} className="text-[2rem] heading-block focus:outline-none">
          Demande de revendication envoyée
        </h2>
        <p className="mt-2">
          Votre demande pour la fiche « {done.establishment.name} » a bien été reçue. Notre équipe
          va vérifier votre justificatif ; vous serez prévenu par e-mail de sa décision.
        </p>
        <p className="mt-2">
          Une fois la demande acceptée, vous pourrez compléter la fiche depuis votre espace
          établissement.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/espace-prestataire#mes-revendications">
            Suivre mes revendications
          </ButtonLink>
          <ButtonLink href={establishmentPublicPath(type, slug)} variant="secondary">
            Retour à la fiche
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (existing === undefined) return <LoadingBlock label="Vérification de vos demandes…" />;

  if (existing) {
    const pending = existing.status === 'pending';
    return (
      <Card className="max-w-[44rem] bg-c4 p-5 sm:p-8">
        <h2 className="text-[1.75rem] heading-block">
          {pending ? 'Demande de revendication en cours' : 'Vous gérez déjà cette fiche'}
        </h2>
        <p className="mt-2">
          {pending
            ? `Vous avez déjà envoyé une demande pour la fiche « ${existing.establishment.name} ». Notre équipe l’examine ; vous serez prévenu par e-mail de sa décision.`
            : `Votre demande pour la fiche « ${existing.establishment.name} » a été acceptée : vous pouvez la compléter depuis votre espace établissement.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/espace-prestataire#mes-revendications">
            Suivre mes revendications
          </ButtonLink>
          <ButtonLink href={establishmentPublicPath(type, slug)} variant="secondary">
            Retour à la fiche
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-[44rem] p-5 sm:p-8">
      <form
        method="post"
        action={`/revendiquer/${type}/${slug}`}
        encType="multipart/form-data"
        noValidate
        className="flex flex-col gap-5"
        aria-labelledby="claim-form-title"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <h2 id="claim-form-title" className="text-[1.75rem] heading-block">
            Revendiquer « {name} »
          </h2>
          <p className="mt-2 text-muted">
            Les champs marqués d’un astérisque (*) sont obligatoires. Ces informations ne sont
            visibles que par l’équipe ProtectIci.
          </p>
        </div>

        <FormError message={formError} />

        <RadioGroup
          name="claim-submitter-role"
          legend={
            <>
              Votre qualité au sein de l’établissement
              <span aria-hidden="true" className="text-danger">
                {' '}
                *
              </span>
            </>
          }
          value={role}
          onChange={(v) => {
            setRole(v);
            setErrors((x) => ({ ...x, submitter_role: undefined }));
          }}
          error={errors.submitter_role}
          options={(Object.keys(SUBMITTER_LABELS) as SubmitterRole[]).map((v) => ({
            value: v,
            label: SUBMITTER_LABELS[v],
          }))}
        />

        <Input
          id="claim-phone"
          label="Téléphone"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint="Numéro auquel notre équipe peut vous joindre pour vérifier la demande."
          disabled={busy}
        />

        <Textarea
          id="claim-message"
          label={
            <>
              Message <span className="font-normal text-ink-2">(facultatif)</span>
            </>
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={CLAIM_MESSAGE_MAX}
          hint={`Précisez votre fonction ou tout élément utile (${message.length}/${CLAIM_MESSAGE_MAX}).`}
          error={errors.message}
          disabled={busy}
        />

        <FileInput
          id="claim-document"
          label="Justificatif"
          required
          rules={CLAIM_DOCUMENT_RULES}
          hint={`Agrément, extrait RCCM, carte professionnelle ou courrier officiel. ${CLAIM_DOCUMENT_RULES.typesLabel}, ${formatBytes(CLAIM_DOCUMENT_RULES.maxBytes)} maximum.`}
          error={errors.document}
          disabled={busy}
          onChange={(f, problem) => {
            setFile(f);
            setErrors((x) => ({ ...x, document: problem ?? undefined }));
          }}
        />

        <Checkbox
          id="claim-consent"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (e.target.checked) setErrors((x) => ({ ...x, consent: undefined }));
          }}
          error={errors.consent}
          disabled={busy}
          label={
            <>
              Je certifie être habilité à représenter cet établissement et j’accepte que ProtectIci
              vérifie les informations et le justificatif transmis (
              <Link href="/confidentialite" className="underline">
                politique de confidentialité
              </Link>
              ).
              <span aria-hidden="true" className="text-danger">
                {' '}
                *
              </span>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-5">
          <Button type="submit" variant="solid" size="lg" loading={busy}>
            {busy ? 'Envoi en cours…' : 'Envoyer ma demande'}
          </Button>
          <ButtonLink href={establishmentPublicPath(type, slug)} variant="ghost">
            Annuler
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
