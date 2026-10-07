'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { forgotPasswordSchema, formToObject, validate, type FieldErrors } from '@/lib/validation';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = validate(forgotPasswordSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      await clientApi.forgotPassword(parsed.data.email);
      setSent(true); // message identique que le compte existe ou non (pas d'énumération)
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <FormSuccess message="Si un compte existe pour cette adresse, un e-mail contenant un lien de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables." />
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
        required
      />
      <Button type="submit" loading={busy}>
        Envoyer le lien
      </Button>
    </form>
  );
}
