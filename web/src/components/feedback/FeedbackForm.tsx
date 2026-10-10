'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, describeError, errorMessage } from '@/lib/api/errors';
import type { FeedbackInput, FeedbackReceipt, ReferenceData } from '@/lib/api/types';
import { FEEDBACK_ACTION_LABELS, FEEDBACK_TARGET_LABELS } from '@/lib/labels';
import { FEEDBACK_COMMENT_MAX } from '@/lib/wave-b-schemas';
import { useAsyncAction } from '@/lib/use-async';
import { newIdempotencyKey } from '@/lib/uuid';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { ProviderPicker, type PickedProvider } from '../directory/ProviderPicker';
import { ErrorSummary } from '../establishment/ErrorSummary';
import { Button, ButtonLink } from '../ui/Button';
import { FormError } from '../ui/Field';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { ReferenceCard } from '../ui/ReferenceCard';
import { Select } from '../ui/Select';
import { Stepper } from '../ui/Stepper';
import { Textarea } from '../ui/Textarea';
import {
  buildFeedbackBody,
  emptyFeedbackDraft,
  FEEDBACK_STEPS,
  stepIndexOfField,
  TOPICS_UNAVAILABLE,
  validateFeedbackStep,
  type FeedbackDraft,
} from './feedback-draft';
import { RadioGroup } from './RadioGroup';

const ACTION_OPTIONS = (Object.keys(FEEDBACK_ACTION_LABELS) as (keyof typeof FEEDBACK_ACTION_LABELS)[]).map(
  (value) => ({ value, label: FEEDBACK_ACTION_LABELS[value] }),
);
const TARGET_OPTIONS = (Object.keys(FEEDBACK_TARGET_LABELS) as (keyof typeof FEEDBACK_TARGET_LABELS)[]).map(
  (value) => ({ value, label: FEEDBACK_TARGET_LABELS[value] }),
);

/** Annonce le compteur de caractères seulement quand la saisie s'arrête (pas à chaque frappe). */
function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function FeedbackForm({
  reference,
  initialProvider = null,
}: {
  reference: ReferenceData;
  initialProvider?: PickedProvider | null;
}) {
  const [draft, setDraft] = useState<FeedbackDraft>(() => emptyFeedbackDraft(initialProvider));
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summarySignal, setSummarySignal] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(null);
  const { run, busy } = useAsyncAction();
  const spam = useAntiSpam();
  const keyRef = useRef<{ key: string; sig: string }>({ key: newIdempotencyKey(), sig: '' });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);

  const topics = reference.feedback_topics ?? [];
  const topicsAvailable = topics.length > 0;
  const step = FEEDBACK_STEPS[index]!;
  const last = index === FEEDBACK_STEPS.length - 1;
  const announced = useDebounced(draft.comment.length, 700);

  useEffect(() => {
    if (focusHeading.current) {
      headingRef.current?.focus();
      focusHeading.current = false;
    }
  });

  function goTo(i: number) {
    focusHeading.current = true;
    setIndex(i);
  }

  function set(patch: Partial<FeedbackDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function fail(errs: Record<string, string>, at: number) {
    setErrors(errs);
    setFormError(null);
    setSummarySignal((n) => n + 1);
    if (at !== index) goTo(at);
  }

  function next() {
    const errs = validateFeedbackStep(index, draft, topicsAvailable);
    if (errs) return fail(errs, index);
    setErrors({});
    setFormError(null);
    goTo(index + 1);
  }

  function previous() {
    setErrors({});
    setFormError(null);
    goTo(Math.max(0, index - 1));
  }

  async function submit() {
    for (let i = 0; i < FEEDBACK_STEPS.length; i++) {
      const errs = validateFeedbackStep(i, draft, topicsAvailable);
      if (errs) return fail(errs, i);
    }
    if (!spam.ready) {
      setErrors({});
      setFormError(TURNSTILE_REQUIRED_MESSAGE);
      return;
    }
    setErrors({});
    setFormError(null);
    const body = buildFeedbackBody(draft);
    // Même clé pour un nouvel essai identique ; nouvelle clé si les données ont changé.
    const sig = JSON.stringify(body);
    if (keyRef.current.sig !== sig) keyRef.current = { key: newIdempotencyKey(), sig };
    const payload: FeedbackInput = { ...body, ...spam.payload() };
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.createFeedback(payload, keyRef.current.key);
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    spam.reset();
    if (result.ok) {
      keyRef.current = { key: newIdempotencyKey(), sig: '' };
      focusHeading.current = true;
      setReceipt(result.value);
      return;
    }
    if (caught instanceof ApiError && caught.status === 422) {
      const { fields, form } = describeError(caught);
      const keys = Object.keys(fields);
      if (keys.length) {
        const at = Math.min(...keys.map(stepIndexOfField));
        const onStep = Object.fromEntries(keys.filter((k) => stepIndexOfField(k) === at).map((k) => [k, fields[k]!]));
        return fail(onStep, at);
      }
      setFormError(form);
      return;
    }
    if (caught) setFormError(errorMessage(caught));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (last) void submit();
    else next();
  }

  function restart() {
    setDraft(emptyFeedbackDraft(null));
    setIndex(0);
    setErrors({});
    setFormError(null);
    setReceipt(null);
    keyRef.current = { key: newIdempotencyKey(), sig: '' };
    spam.reset();
  }

  if (receipt) {
    return (
      <div className="flex max-w-prose flex-col gap-5">
        <ReferenceCard title="Votre message a bien été envoyé" reference={receipt.reference} message={receipt.message} />
        <p className="font-semibold">Conservez ce numéro, il vous permettra de suivre votre dossier.</p>
        <p className="text-sm text-muted">
          Un accusé de réception vous a été envoyé par e-mail avec cette référence.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/dis-moi-tout/suivi">Suivre mon dossier</ButtonLink>
          <Button variant="secondary" onClick={restart}>
            Envoyer un autre message
          </Button>
        </div>
      </div>
    );
  }

  const serviceName = reference.service_types.find((s) => String(s.id) === draft.service_type_id)?.name;
  const topicName = topics.find((t) => String(t.id) === draft.topic_id)?.name;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-prose flex-col gap-5">
      <Stepper steps={[...FEEDBACK_STEPS]} current={index} />
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
        {step.label}
      </h2>
      <ErrorSummary errors={errors} focusSignal={summarySignal} />

      {step.id === 'info' ? (
        <div className="flex flex-col gap-4">
          <Select
            label="Civilité (facultatif)"
            name="civility"
            value={draft.civility}
            autoComplete="honorific-prefix"
            onChange={(e) => set({ civility: e.target.value })}
            error={errors.civility}
          >
            <option value="">Non précisée</option>
            <option value="M.">M.</option>
            <option value="Mme">Mme</option>
            <option value="Mlle">Mlle</option>
          </Select>
          <Input
            label="Nom"
            name="last_name"
            required
            autoComplete="family-name"
            value={draft.last_name}
            onChange={(e) => set({ last_name: e.target.value })}
            error={errors.last_name}
          />
          <Input
            label="Prénoms"
            name="first_name"
            required
            autoComplete="given-name"
            value={draft.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
            error={errors.first_name}
          />
          <Input
            label="Adresse e-mail"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            hint="Votre dossier vous sera confirmé à cette adresse."
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Téléphone (facultatif)"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
            error={errors.phone}
          />
        </div>
      ) : null}

      {step.id === 'provider' ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            Votre message concerne un prestataire de l’annuaire ? Recherchez-le ici. Cette étape est facultative.
          </p>
          <ProviderPicker
            selected={draft.provider ? [draft.provider] : []}
            onChange={(next) => set({ provider: next[0] ?? null })}
            max={1}
            label="Rechercher un prestataire"
          />
          {errors.provider_slug ? <FormError message={errors.provider_slug} /> : null}
        </div>
      ) : null}

      {step.id === 'action' ? (
        <RadioGroup
          legend="Que désirez-vous faire ?"
          name="action_type"
          options={ACTION_OPTIONS}
          value={draft.action_type as FeedbackInput['action_type'] | ''}
          onChange={(v) => set({ action_type: v })}
          error={errors.action_type}
        />
      ) : null}

      {step.id === 'target' ? (
        <div className="flex flex-col gap-4">
          <RadioGroup
            legend="Votre message concerne"
            name="target_type"
            options={TARGET_OPTIONS}
            value={draft.target_type as FeedbackInput['target_type'] | ''}
            onChange={(v) => set({ target_type: v })}
            error={errors.target_type}
          />
          {draft.target_type === 'service' ? (
            <Select
              label="Type de prestation"
              name="service_type_id"
              required
              value={draft.service_type_id}
              onChange={(e) => set({ service_type_id: e.target.value })}
              error={errors.service_type_id}
            >
              <option value="">Choisissez une prestation</option>
              {reference.service_types.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : null}
          {draft.target_type === 'product' ? (
            <Input
              label="Produit concerné (facultatif)"
              name="product_type"
              maxLength={150}
              value={draft.product_type}
              onChange={(e) => set({ product_type: e.target.value })}
              error={errors.product_type}
            />
          ) : null}
          {draft.target_type && draft.target_type !== 'product' ? (
            topicsAvailable ? (
              <Select
                label="Sujet"
                name="topic_id"
                required
                value={draft.topic_id}
                onChange={(e) => set({ topic_id: e.target.value })}
                error={errors.topic_id}
              >
                <option value="">Choisissez un sujet</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <FormError message={TOPICS_UNAVAILABLE} />
            )
          ) : null}
          <Input
            label="Lieu rattaché (facultatif)"
            name="location"
            maxLength={190}
            hint="Agence, site, quartier ou ville concernés."
            value={draft.location}
            onChange={(e) => set({ location: e.target.value })}
            error={errors.location}
          />
          <div className="flex flex-col gap-1">
            <Textarea
              label="Commentaire"
              name="comment"
              required
              rows={6}
              hint="Entre 10 et 3 000 caractères. N’indiquez ni mot de passe ni donnée bancaire."
              value={draft.comment}
              onChange={(e) => set({ comment: e.target.value })}
              error={errors.comment}
            />
            <p className="text-right text-sm text-muted">
              {draft.comment.length} / {FEEDBACK_COMMENT_MAX}
            </p>
            <p role="status" aria-live="polite" className="sr-only">
              {announced > 0 ? `${announced} caractères sur ${FEEDBACK_COMMENT_MAX}` : ''}
            </p>
          </div>
        </div>
      ) : null}

      {step.id === 'review' ? (
        <div className="flex flex-col gap-5">
          <p className="text-muted">Relisez vos réponses avant l’envoi. Vous pouvez revenir en arrière pour les modifier.</p>
          <dl className="grid gap-3 rounded-md border border-line p-4 sm:grid-cols-[12rem_1fr]">
            <Row label="Civilité" value={draft.civility || 'Non précisée'} />
            <Row label="Nom" value={draft.last_name} />
            <Row label="Prénoms" value={draft.first_name} />
            <Row label="Adresse e-mail" value={draft.email} />
            <Row label="Téléphone" value={draft.phone || 'Non renseigné'} />
            <Row label="Prestataire" value={draft.provider?.name ?? 'Aucun'} />
            <Row
              label="Votre demande"
              value={FEEDBACK_ACTION_LABELS[draft.action_type as keyof typeof FEEDBACK_ACTION_LABELS] ?? ''}
            />
            <Row
              label="Concerne"
              value={FEEDBACK_TARGET_LABELS[draft.target_type as keyof typeof FEEDBACK_TARGET_LABELS] ?? ''}
            />
            {draft.target_type === 'service' ? <Row label="Type de prestation" value={serviceName ?? ''} /> : null}
            {draft.target_type === 'product' ? (
              <Row label="Produit" value={draft.product_type || 'Non précisé'} />
            ) : (
              <Row label="Sujet" value={topicName ?? ''} />
            )}
            <Row label="Lieu rattaché" value={draft.location || 'Non précisé'} />
            <Row label="Commentaire" value={draft.comment} />
          </dl>
          <Checkbox
            name="consent"
            checked={draft.consent}
            onChange={(e) => set({ consent: e.target.checked })}
            error={errors.consent}
            label={
              <>
                J’accepte que ProtectIci enregistre les informations saisies pour traiter mon message et y répondre,
                et les transmette au prestataire concerné le cas échéant. Elles sont conservées 36 mois après la
                clôture du dossier, puis anonymisées.{' '}
                <Link href="/confidentialite" className="underline">
                  Politique de confidentialité
                </Link>
              </>
            }
          />
          <AntiSpamFields spam={spam} />
        </div>
      ) : null}

      <FormError message={formError} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <Button variant="secondary" onClick={previous} disabled={busy}>
            Précédent
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={busy}>
          {last ? 'Envoyer mon message' : 'Suivant'}
        </Button>
      </div>

      {index === 0 ? (
        <p className="text-sm">
          Vous avez déjà envoyé un message ?{' '}
          <Link href="/dis-moi-tout/suivi" className="underline">
            Suivre un dossier
          </Link>
        </p>
      ) : null}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="whitespace-pre-line break-words">{value}</dd>
    </>
  );
}
