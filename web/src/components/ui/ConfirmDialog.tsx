'use client';

import { useState, type ReactNode } from 'react';
import { describeError } from '@/lib/api/errors';
import { Button } from './Button';
import { FormError } from './Field';
import { Input } from './Input';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** Saisie exacte exigée (suppression : nom ; anonymisation : e-mail). */
  expectedText?: string;
  expectedLabel?: string;
  /** Motif obligatoire (≥ minReason caractères). Transmis à onConfirm. */
  reasonLabel?: string;
  minReason?: number;
  /** Lève une erreur (ApiError) pour l'afficher dans la boîte sans la fermer. */
  onConfirm: (reason?: string) => Promise<void>;
}

/**
 * Confirmation d'une action sensible. Les boutons sont désactivés pendant l'appel (pas de double
 * envoi) ; la boîte se ferme seulement en cas de succès.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      {props.open ? <ConfirmBody {...props} /> : null}
    </Modal>
  );
}

function ConfirmBody({
  onClose,
  children,
  confirmLabel,
  tone = 'primary',
  expectedText,
  expectedLabel,
  reasonLabel,
  minReason = 10,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reasonOk = !reasonLabel || reason.trim().length >= minReason;
  const textOk = expectedText === undefined || typed === expectedText;

  async function submit() {
    if (busy || !reasonOk || !textOk) return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await onConfirm(reasonLabel ? reason.trim() : undefined);
      onClose();
    } catch (e) {
      const d = describeError(e);
      setFieldErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      noValidate
    >
      {children ? <div>{children}</div> : null}
      {reasonLabel ? (
        <Textarea
          label={reasonLabel}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint={`Au moins ${minReason} caractères (${reason.trim().length}/${minReason}).`}
          error={fieldErrors.reason}
          maxLength={1000}
          disabled={busy}
        />
      ) : null}
      {expectedText !== undefined ? (
        <Input
          label={expectedLabel ?? 'Saisissez le texte demandé'}
          required
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          hint={
            <>
              Saisissez exactement : <strong>{expectedText}</strong>
            </>
          }
          error={fieldErrors.confirm_name ?? fieldErrors.confirm_email}
          autoComplete="off"
          disabled={busy}
        />
      ) : null}
      <FormError message={formError} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annuler
        </Button>
        <Button
          type="submit"
          variant={tone === 'danger' ? 'danger' : 'primary'}
          loading={busy}
          disabled={!reasonOk || !textOk}
        >
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
