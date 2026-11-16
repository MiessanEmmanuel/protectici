'use client';

import { useState } from 'react';
import { claimsApi } from '@/lib/api/claims';
import { ApiError, firstFieldErrors } from '@/lib/api/errors';
import type { AdminEstablishment, EstablishmentType } from '@/lib/api/types';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Input } from '../../ui/Input';
import { useToast } from '../../ui/Toast';
import { Panel } from '../etablissements/panel';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Raccourci admin « Attribuer à un compte » (POST /admin/establishments/{type}/{id}/owner,
 * contrat §10.3) : visible seulement quand la fiche n'a pas de propriétaire.
 */
export function AssignOwnerPanel({
  type,
  id,
  name,
  onAssigned,
}: {
  type: EstablishmentType;
  id: number;
  name: string;
  onAssigned: (establishment: AdminEstablishment) => void;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const focusInput = () => document.getElementById('assign-owner-email')?.focus();

  function ask() {
    const value = email.trim();
    if (!value) setError('Saisissez l’adresse e-mail du compte.');
    else if (!EMAIL.test(value)) setError('Adresse e-mail invalide.');
    else {
      setError(undefined);
      setOpen(true);
      return;
    }
    focusInput();
  }

  async function confirm() {
    try {
      const updated = await claimsApi.adminAssignOwner(type, id, email);
      toast.show('Fiche attribuée : le compte a été prévenu par e-mail.', 'success');
      setEmail('');
      onAssigned(updated);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const fields = firstFieldErrors(e);
        setError(fields.email ?? e.message);
        setTimeout(() => focusInput(), 0);
        return; // la boîte se ferme ; l'erreur s'affiche sous le champ
      }
      if (e instanceof ApiError && e.status === 409) {
        throw new ApiError(409, e.message || 'Cette fiche a déjà un propriétaire.');
      }
      throw e;
    }
  }

  return (
    <Panel
      title="Attribuer à un compte"
      titleId="s-attribuer"
      aria-labelledby="s-attribuer"
      hint="Cette fiche n’a pas de propriétaire. Saisissez l’adresse e-mail d’un compte existant pour la lui confier."
    >
      <form
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <Input
          id="assign-owner-email"
          label="Adresse e-mail du compte"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          error={error}
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="secondary" className="sm:mt-8">
          Attribuer
        </Button>
      </form>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Attribuer la fiche"
        confirmLabel="Attribuer"
        onConfirm={confirm}
      >
        <p>
          Le compte <strong>{email.trim()}</strong> deviendra propriétaire de la fiche{' '}
          <strong>{name}</strong> et pourra la modifier. Un e-mail lui sera envoyé et l’opération
          sera journalisée.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}
