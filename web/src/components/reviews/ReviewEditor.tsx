'use client';

import { useState, type FormEvent } from 'react';
import type { ReviewInput } from '@/lib/api/types';
import { useAsyncAction } from '@/lib/use-async';
import { validate } from '@/lib/validation';
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  reviewSchema,
} from '@/lib/wave-b-schemas';
import { Button } from '../ui/Button';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { StarRatingInput } from './StarRatingInput';

interface Props {
  initial?: { rating: number; title: string | null; body: string };
  submitLabel: string;
  /** Lève une ApiError en cas d'échec ; un retour normal signifie « terminé ». */
  onSubmit: (input: ReviewInput) => Promise<void>;
  onCancel?: () => void;
  idPrefix?: string;
}

/** Champs et validation communs au dépôt d'un avis (fiche) et à sa modification (compte). */
export function ReviewEditor({ initial, submitLabel, onSubmit, onCancel, idPrefix = 'avis' }: Props) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, error, clearError } = useAsyncAction();

  const fieldErrors = { ...errors, ...(error?.fields ?? {}) };
  const length = body.trim().length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    clearError();
    const result = validate(reviewSchema, {
      rating: rating || undefined,
      title,
      body,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const trimmedTitle = result.data.title?.trim();
    await run(() =>
      onSubmit({
        rating: result.data.rating,
        title: trimmedTitle ? trimmedTitle : initial ? null : undefined,
        body: result.data.body,
      }),
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <StarRatingInput
        value={rating}
        onChange={(v) => {
          setRating(v);
          clearError();
          setErrors((p) => ({ ...p, rating: '' }));
        }}
        error={fieldErrors.rating || undefined}
        disabled={busy}
        required
      />
      <Input
        id={`${idPrefix}-titre`}
        label="Titre de votre avis (facultatif)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={fieldErrors.title}
        disabled={busy}
      />
      <div>
        <Textarea
          id={`${idPrefix}-texte`}
          label="Votre avis"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={fieldErrors.body}
          hint={`Entre ${REVIEW_BODY_MIN} et ${REVIEW_BODY_MAX} caractères.`}
          disabled={busy}
        />
        <p aria-live="polite" className="mt-1 text-sm text-muted">
          {length} / {REVIEW_BODY_MAX} caractères
        </p>
      </div>
      <FormError message={error?.form} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}
