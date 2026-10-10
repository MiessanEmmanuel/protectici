'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { FeedbackTracking } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { validate } from '@/lib/validation';
import { feedbackTrackSchema } from '@/lib/wave-b-schemas';
import { useAsyncAction } from '@/lib/use-async';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button } from '../ui/Button';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';
import { StatusPill } from '../ui/StatusPill';

export const TRACK_NOT_FOUND = 'Aucun dossier ne correspond à ces informations.';

/** Suivi d'un dossier « Dis-moi tout » : référence et e-mail envoyés en POST, jamais dans l'URL. */
export function FeedbackTracker() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<FeedbackTracking | null>(null);
  const { run, busy } = useAsyncAction();
  const spam = useAntiSpam();
  const resultRef = useRef<HTMLHeadingElement>(null);
  const focusResult = useRef(false);

  useEffect(() => {
    if (result && focusResult.current) {
      resultRef.current?.focus();
      focusResult.current = false;
    }
  }, [result]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const res = validate(feedbackTrackSchema, { reference, email });
    if (!res.ok) {
      setErrors(res.errors);
      setFormError(null);
      return;
    }
    if (!spam.ready) {
      setErrors({});
      setFormError(TURNSTILE_REQUIRED_MESSAGE);
      return;
    }
    setErrors({});
    setFormError(null);
    setResult(null);
    let caught: unknown = null;
    const out = await run(async () => {
      try {
        return await clientApi.trackFeedback({
          reference: res.data.reference,
          email: res.data.email,
          ...spam.payload(),
        } as { reference: string; email: string });
      } catch (err) {
        caught = err;
        throw err;
      }
    });
    spam.reset();
    if (out.ok) {
      focusResult.current = true;
      setResult(out.value);
      return;
    }
    if (caught instanceof ApiError && caught.status === 404) setFormError(TRACK_NOT_FOUND);
    else setFormError(errorMessage(caught));
  }

  return (
    <div className="flex max-w-prose flex-col gap-8">
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
        <Input
          label="Référence du dossier"
          name="reference"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="DMT-2026-000123"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={errors.reference}
        />
        <Input
          label="Adresse e-mail utilisée"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <AntiSpamFields spam={spam} />
        <FormError message={formError} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy}>
            Consulter mon dossier
          </Button>
          <Link href="/dis-moi-tout" className="underline">
            Envoyer un nouveau message
          </Link>
        </div>
      </form>

      {result ? (
        <section aria-labelledby="track-title" className="flex flex-col gap-4 rounded-lg border border-line p-5">
          <h2 id="track-title" ref={resultRef} tabIndex={-1} className="text-xl font-bold outline-none">
            Dossier {result.reference}
          </h2>
          <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <dt className="font-semibold text-muted">Statut</dt>
            <dd>
              <StatusPill kind="feedback" status={result.status} />
            </dd>
            <dt className="font-semibold text-muted">Envoyé le</dt>
            <dd>{formatDateTime(result.created_at)}</dd>
            {result.provider_name ? (
              <>
                <dt className="font-semibold text-muted">Prestataire</dt>
                <dd>{result.provider_name}</dd>
              </>
            ) : null}
          </dl>
          <div>
            <h3 className="font-semibold">Réponses</h3>
            {result.replies.length === 0 ? (
              <p className="mt-2 text-muted">Aucune réponse pour le moment. Nous vous écrirons dès qu’il y en aura une.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-3">
                {result.replies.map((r, i) => (
                  <li key={`${r.created_at}-${i}`} className="rounded-md bg-surface-alt p-3">
                    <p className="text-sm text-muted">{formatDateTime(r.created_at)}</p>
                    <p className="mt-1 whitespace-pre-line break-words">{r.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
