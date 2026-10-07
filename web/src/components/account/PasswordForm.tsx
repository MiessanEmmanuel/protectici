'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { changePasswordSchema, formToObject, validate, type FieldErrors } from '@/lib/validation';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setFormError(null);
    const parsed = validate(changePasswordSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      await clientApi.changePassword(parsed.data);
      formRef.current?.reset();
      setSaved(true);
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormError message={formError} />
      <FormSuccess message={saved ? 'Votre mot de passe a été modifié.' : null} />
      <Input
        label="Mot de passe actuel"
        name="current_password"
        type="password"
        autoComplete="current-password"
        error={errors.current_password}
        required
      />
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
        label="Confirmer le nouveau mot de passe"
        name="password_confirmation"
        type="password"
        autoComplete="new-password"
        error={errors.password_confirmation}
        required
      />
      <div>
        <Button type="submit" loading={busy}>
          Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}
