'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { forgotPasswordSchema, formToObject, validate, type FieldErrors } from '@/lib/validation';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const spam = useAntiSpam();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = validate(forgotPasswordSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    if (spam.trapped) return setSent(true); // champ piège rempli : succès simulé, aucun appel
    if (!spam.ready) return setFormError(TURNSTILE_REQUIRED_MESSAGE);
    setBusy(true);
    try {
      const token = spam.payload().turnstile_token;
      await clientApi.forgotPassword(parsed.data.email, token ? { turnstile_token: token } : undefined);
      setSent(true); // message identique que le compte existe ou non (pas d'énumération)
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      spam.reset();
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
      <AntiSpamFields spam={spam} />
      <Button type="submit" loading={busy}>
        Envoyer le lien
      </Button>
    </form>
  );
}
