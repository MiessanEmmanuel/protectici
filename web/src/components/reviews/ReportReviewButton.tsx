'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { ReviewReportReason } from '@/lib/api/types';
import { REPORT_REASON_LABELS } from '@/lib/labels';
import { buildHref } from '@/lib/search-params';
import { useAsyncAction } from '@/lib/use-async';
import { validate } from '@/lib/validation';
import { reviewReportSchema } from '@/lib/wave-b-schemas';
import { useSession } from '../layout/SessionProvider';
import { Button, ButtonLink } from '../ui/Button';
import { FormError } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReviewReportReason[];

/** Bouton « Signaler » d'un avis publié : îlot client dans une liste rendue par le serveur. */
export function ReportReviewButton({
  reviewId,
  redirectTo,
}: {
  reviewId: number;
  redirectTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();

  if (done) {
    return (
      <p role="status" className="text-sm text-muted">
        Signalement envoyé. Merci.
      </p>
    );
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Signaler
        <span className="sr-only"> cet avis</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Signaler cet avis">
        {open ? (
          <ReportBody
            reviewId={reviewId}
            redirectTo={redirectTo}
            onClose={() => setOpen(false)}
            onDone={() => {
              setDone(true);
              setOpen(false);
              toast.show('Merci, votre signalement a été transmis à la modération.', 'success');
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function ReportBody({
  reviewId,
  redirectTo,
  onClose,
  onDone,
}: {
  reviewId: number;
  redirectTo: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user, status } = useSession();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy, error } = useAsyncAction();

  if (status === 'loading') return <p role="status">Vérification de votre session…</p>;
  if (status === 'anonymous' || !user) {
    return (
      <div>
        <p>Connectez-vous pour signaler un avis.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={buildHref('/connexion', { redirect: redirectTo })}>
            Se connecter
          </ButtonLink>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const result = validate(reviewReportSchema, {
      reason: reason || undefined,
      details: details.trim() || undefined,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const res = await run(async () => {
      try {
        await clientApi.reportReview(reviewId, result.data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          throw new ApiError(404, 'Cet avis n’est plus disponible.');
        }
        throw err;
      }
    });
    if (res.ok) onDone();
  }

  const fieldErrors = { ...errors, ...(error?.fields ?? {}) };
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <Select
        label="Raison du signalement"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={fieldErrors.reason}
        disabled={busy}
      >
        <option value="">Choisissez une raison</option>
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {REPORT_REASON_LABELS[r]}
          </option>
        ))}
      </Select>
      <Textarea
        label="Précisions (facultatif)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        error={fieldErrors.details}
        hint="1 000 caractères au maximum."
        disabled={busy}
      />
      <FormError message={error?.form} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button type="submit" loading={busy}>
          Envoyer le signalement
        </Button>
      </div>
    </form>
  );
}
