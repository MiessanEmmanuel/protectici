'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import {
  branchToDraft,
  buildBranchesInput,
  MAX_BRANCHES,
  validateBranches,
  type BranchDraft,
} from '@/lib/establishment-schemas';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { useToast } from '../ui/Toast';
import { BranchesEditor } from './BranchesEditor';
import { ErrorSummary } from './ErrorSummary';
import type { TabProps } from './manager-types';

/** Agences d'un prestataire : la liste est envoyée en remplacement complet. */
export function BranchesTab({ est, reference, readOnly, onSaved }: TabProps) {
  const [list, setList] = useState<BranchDraft[]>(() => est.branches.map(branchToDraft));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signal, setSignal] = useState(0);
  const { run, busy } = useAsyncAction();
  const toast = useToast();

  async function submit() {
    setFormError(null);
    setSaved(false);
    const res = validateBranches(list);
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
          branches: buildBranchesInput(list),
        });
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      onSaved(result.value);
      // Les nouvelles agences reçoivent leur `id` : sans lui, le prochain envoi les recréerait.
      setList(result.value.branches.map(branchToDraft));
      setSaved(true);
      toast.show('Agences enregistrées.', 'success');
    } else if (caught !== null) {
      const d = describeError(caught);
      setErrors(d.fields);
      setFormError(d.form);
      setSignal((n) => n + 1);
    }
  }

  return (
    <form
      method="post"
      className="flex max-w-3xl flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-muted">
        Ajoutez vos autres adresses (jusqu’à {MAX_BRANCHES}) pour que les visiteurs trouvent l’agence
        la plus proche. L’adresse de l’onglet « Informations » reste celle du siège.
      </p>
      <ErrorSummary errors={errors} focusSignal={signal} />
      <FormError message={formError} />
      <FormSuccess message={saved ? 'La liste des agences a été enregistrée.' : null} />
      <BranchesEditor
        value={list}
        onChange={(next) => {
          setSaved(false);
          setList(next);
        }}
        errors={errors}
        reference={reference}
        disabled={readOnly || busy}
        idPrefix="mgr-branches"
      />
      {readOnly ? null : (
        <div>
          <Button type="submit" loading={busy}>
            Enregistrer les agences
          </Button>
        </div>
      )}
    </form>
  );
}
