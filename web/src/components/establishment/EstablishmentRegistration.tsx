'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, describeError, errorMessage } from '@/lib/api/errors';
import type { MyEstablishment, ReferenceData } from '@/lib/api/types';
import {
  buildCreateInput,
  emptyDraft,
  stepsFor,
  validateStep,
  type EstablishmentDraft,
  type StepId,
} from '@/lib/establishment-schemas';
import { DOCUMENT_TYPE_LABELS } from '@/lib/labels';
import { newIdempotencyKey } from '@/lib/uuid';
import { useAsyncAction } from '@/lib/use-async';
import { Button, ButtonLink } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormError } from '../ui/Field';
import { Stepper } from '../ui/Stepper';
import { StepContent } from './RegistrationSteps';

/** Étape portant chaque champ de l'API (pour ramener l'utilisateur au champ fautif après un 422). */
function stepOfField(field: string): StepId {
  const root = field.split('.')[0]!;
  if (root === 'type') return 'type';
  if (['submitter_role', 'is_in_service'].includes(root)) return 'declarant';
  if (
    ['name', 'description', 'company_type_ids', 'service_type_ids', 'force_type_id', 'procedure_type_ids'].includes(
      root,
    )
  )
    return 'identity';
  if (['city_id', 'district_id', 'address', 'geo_description', 'plus_code', 'lat', 'lng'].includes(root))
    return 'location';
  if (
    ['rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number', 'approval_expires_at', 'executives'].includes(
      root,
    )
  )
    return 'legal';
  if (root === 'consent') return 'review';
  if (root === 'documents') return 'documents';
  return 'contacts';
}

interface Outcome {
  created: MyEstablishment;
  failures: { name: string; message: string }[];
}

export function EstablishmentRegistration({ reference }: { reference: ReferenceData }) {
  const [draft, setDraft] = useState<EstablishmentDraft>(emptyDraft);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { run, busy } = useAsyncAction();
  // Une clé par soumission : conservée après erreur réseau/5xx/429, régénérée après un 422.
  const keyRef = useRef(newIdempotencyKey());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<'heading' | 'summary' | null>(null);

  const steps = stepsFor(draft.type);
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex]!;
  const last = safeIndex === steps.length - 1;
  const errorKeys = Object.keys(errors);

  useEffect(() => {
    if (focusTarget.current === 'summary') summaryRef.current?.focus();
    else if (focusTarget.current === 'heading') headingRef.current?.focus();
    focusTarget.current = null;
  });

  function goTo(i: number, focus: 'heading' | 'summary' = 'heading') {
    focusTarget.current = focus;
    setIndex(i);
  }

  function set(patch: Partial<EstablishmentDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function next() {
    const res = validateStep(step.id, draft);
    if (!res.ok) {
      setErrors(res.errors);
      setFormError(null);
      goTo(safeIndex, 'summary');
      return;
    }
    setErrors({});
    setFormError(null);
    goTo(safeIndex + 1);
  }

  function previous() {
    setErrors({});
    setFormError(null);
    goTo(Math.max(0, safeIndex - 1));
  }

  async function submit() {
    // Revalide toutes les étapes : en cas d'échec, on revient à la première étape fautive.
    for (let i = 0; i < steps.length; i++) {
      const res = validateStep(steps[i]!.id, draft);
      if (!res.ok) {
        setErrors(res.errors);
        setFormError(null);
        goTo(i, 'summary');
        return;
      }
    }
    setErrors({});
    setFormError(null);
    let caught: unknown = null;
    const result = await run(async () => {
      let created: MyEstablishment;
      try {
        created = await clientApi.createEstablishment(buildCreateInput(draft), keyRef.current);
      } catch (e) {
        caught = e;
        if (e instanceof ApiError && e.status === 422) keyRef.current = newIdempotencyKey();
        throw e;
      }
      // La fiche existe : on envoie les justificatifs un par un, sans jamais perdre la fiche.
      const failures: Outcome['failures'] = [];
      for (const doc of draft.documents) {
        try {
          await clientApi.uploadDocument(created.type, created.slug, doc.file, doc.type);
        } catch (e) {
          failures.push({
            name: `${doc.file.name} (${DOCUMENT_TYPE_LABELS[doc.type]})`,
            message: errorMessage(e),
          });
        }
      }
      return { created, failures } satisfies Outcome;
    });

    if (result.ok) {
      setOutcome(result.value);
      setDraft((d) => ({ ...d, documents: [] }));
      focusTarget.current = 'heading';
      return;
    }
    if (caught === null) return; // double clic ignoré
    const d = describeError(caught);
    if (Object.keys(d.fields).length > 0) {
      setErrors(d.fields);
      const first = Object.keys(d.fields)[0]!;
      const target = stepsFor(draft.type).findIndex((s) => s.id === stepOfField(first));
      goTo(target >= 0 ? target : 0, 'summary');
      setFormError(null);
    } else {
      setFormError(d.form);
    }
  }

  if (outcome) {
    return <Confirmation outcome={outcome} headingRef={headingRef} />;
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <Stepper steps={steps} current={safeIndex} />
      <form
        className="mt-5 flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (last) void submit();
          else next();
        }}
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold focus:outline-none focus-visible:outline-2"
        >
          {step.label}
        </h2>

        <div
          ref={summaryRef}
          tabIndex={-1}
          role={errorKeys.length ? 'alert' : undefined}
          className={
            errorKeys.length
              ? 'rounded-md border border-danger bg-danger-soft p-3 text-danger'
              : 'sr-only'
          }
        >
          {errorKeys.length ? (
            <>
              <p className="font-semibold">
                {errorKeys.length === 1
                  ? 'Un champ est à corriger :'
                  : `${errorKeys.length} champs sont à corriger :`}
              </p>
              <ul className="list-disc pl-5">
                {errorKeys.map((k) => (
                  <li key={k}>
                    <a
                      href={`#f-${k}`}
                      className="underline"
                      onClick={(e) => {
                        const el = document.getElementById(`f-${k}`);
                        if (el) {
                          e.preventDefault();
                          el.focus();
                        }
                      }}
                    >
                      {errors[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <FormError message={formError} />

        <StepContent
          step={step.id}
          draft={draft}
          set={set}
          errors={errors}
          reference={reference}
          disabled={busy}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={previous} disabled={busy || safeIndex === 0}>
            Précédent
          </Button>
          {last ? (
            <Button type="submit" loading={busy}>
              {busy ? 'Envoi en cours…' : 'Envoyer ma demande'}
            </Button>
          ) : (
            <Button type="submit" disabled={busy}>
              Suivant
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Confirmation({
  outcome,
  headingRef,
}: {
  outcome: Outcome;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  useEffect(() => {
    headingRef.current?.focus();
  }, [headingRef]);
  const { created, failures } = outcome;
  return (
    <Card className="mx-auto max-w-2xl">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold focus:outline-none">
        Demande reçue : en attente de validation
      </h2>
      <p className="mt-2">
        La fiche « {created.name} » a bien été créée. Notre équipe va l’examiner avant de la
        publier. Vous serez prévenu par e-mail de la décision.
      </p>
      {failures.length > 0 ? (
        <div role="alert" className="mt-4 rounded-md border border-danger bg-danger-soft p-3 text-danger">
          <p className="font-semibold">
            {failures.length === 1
              ? 'Un justificatif n’a pas pu être envoyé :'
              : `${failures.length} justificatifs n’ont pas pu être envoyés :`}
          </p>
          <ul className="list-disc pl-5">
            {failures.map((f) => (
              <li key={f.name}>
                {f.name} : {f.message}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            La fiche est bien créée. Vous pouvez renvoyer ces fichiers depuis l’onglet
            « Justificatifs » de votre espace prestataire.
          </p>
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href={`/espace-prestataire/${created.type}/${created.slug}`}>
          Ouvrir mon espace prestataire
        </ButtonLink>
        <ButtonLink href="/espace-prestataire" variant="secondary">
          Mes établissements
        </ButtonLink>
        <ButtonLink href="/annuaire" variant="ghost">
          Retour à l’annuaire
        </ButtonLink>
      </div>
    </Card>
  );
}
