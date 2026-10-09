'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { emptyDraft, validateStep, type ExecutiveDraft } from '@/lib/establishment-schemas';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { useToast } from '../ui/Toast';
import { ErrorSummary } from './ErrorSummary';
import { ExecutivesEditor } from './ExecutivesEditor';
import { toDraft } from './manager-utils';
import type { TabProps } from './manager-types';

/** Dirigeants d'un prestataire : la liste est envoyée en remplacement complet. */
export function ExecutivesTab({ est, readOnly, onSaved }: TabProps) {
  const [list, setList] = useState<ExecutiveDraft[]>(() => toDraft(est).executives);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signal, setSignal] = useState(0);
  const { run, busy } = useAsyncAction();
  const toast = useToast();

  async function submit() {
    setFormError(null);
    const res = validateStep('legal', { ...emptyDraft(), type: 'provider', executives: list });
    if (!res.ok) {
      setErrors(res.errors);
      setSignal((n) => n + 1);
      return;
    }
    setErrors({});
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.updateMyEstablishment(est.type, est.slug, {
          executives: list.map((e) => ({
            full_name: e.full_name.trim(),
            position: e.position,
            position_label: e.position === 'other' ? e.position_label.trim() : null,
            is_visible: e.is_visible,
          })),
        });
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      onSaved(result.value);
      setSaved(true);
      toast.show('Dirigeants enregistrés.', 'success');
    } else if (caught !== null) {
      const d = describeError(caught);
      setErrors(d.fields);
      setFormError(d.form);
      setSignal((n) => n + 1);
    }
  }

  return (
    <form
      className="flex max-w-3xl flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-muted">
        Vous choisissez, dirigeant par dirigeant, s’il apparaît sur la fiche publique. Les noms non
        publics restent réservés à notre équipe.
      </p>
      <ErrorSummary errors={errors} focusSignal={signal} />
      <FormError message={formError} />
      <FormSuccess message={saved ? 'La liste des dirigeants a été enregistrée.' : null} />
      <ExecutivesEditor
        value={list}
        onChange={(next) => {
          setSaved(false);
          setList(next);
        }}
        errors={errors}
        disabled={readOnly || busy}
        idPrefix="mgr-executives"
      />
      {readOnly ? null : (
        <div>
          <Button type="submit" loading={busy}>
            Enregistrer les dirigeants
          </Button>
        </div>
      )}
    </form>
  );
}
