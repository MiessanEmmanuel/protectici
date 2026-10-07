'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { formToObject, resetPasswordSchema, validate, type FieldErrors } from '@/lib/validation';
import { Button, ButtonLink } from '../ui/Button';
import { ErrorState } from '../ui/EmptyState';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function ResetPasswordForm({ token, email }: { token?: string; email?: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token || !email) {
    return (
      <ErrorState
        title="Lien invalide"
        action={
          <ButtonLink href="/mot-de-passe-oublie" variant="secondary">
            Demander un nouveau lien
          </ButtonLink>
        }
      >
        Ce lien de réinitialisation est incomplet ou a expiré.
      </ErrorState>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = { ...formToObject(e.currentTarget), token, email };
    const parsed = validate(resetPasswordSchema, raw);
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      await clientApi.resetPassword(parsed.data);
      setDone(true);
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form ?? d.fields.token ?? d.fields.email ?? null);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess message="Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter." />
        <ButtonLink href="/connexion">Se connecter</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <p className="text-sm text-muted">
        Compte concerné : <strong>{email}</strong>
      </p>
      <Input
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="10 caractères minimum."
        error={errors.password}
        required
      />
      <Input
        label="Confirmer le mot de passe"
        name="password_confirmation"
        type="password"
        autoComplete="new-password"
        error={errors.password_confirmation}
        required
      />
      <Button type="submit" loading={busy}>
        Enregistrer le mot de passe
      </Button>
      <p className="text-center text-sm">
        <Link href="/connexion">Retour à la connexion</Link>
      </p>
    </form>
  );
}
