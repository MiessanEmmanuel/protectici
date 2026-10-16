'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { FieldErrors } from '@/lib/validation';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

/** Abonnement à la lettre d'information (double opt-in côté API). Réponse toujours identique. */
export function NewsletterForm({ source = 'footer' }: { source?: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Le script Turnstile n'est chargé qu'à la première interaction avec le formulaire.
  const [engaged, setEngaged] = useState(false);
  const running = useRef(false);
  const spam = useAntiSpam();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    running.current = true;
    setFormError(null);
    setMessage(null);
    const form = e.currentTarget;
    // zod (≈30 Ko gzip) est chargé au premier envoi seulement : ce formulaire est dans le pied de page de toutes les pages.
    const [{ newsletterSchema }, { formToObject, validate }] = await Promise.all([
      import('@/lib/content-schemas'),
      import('@/lib/validation'),
    ]);
    const parsed = validate(newsletterSchema, formToObject(form));
    if (!parsed.ok) {
      running.current = false;
      return setErrors(parsed.errors);
    }
    setErrors({});
    if (!spam.ready) {
      running.current = false;
      return setFormError(TURNSTILE_REQUIRED_MESSAGE);
    }
    setBusy(true);
    try {
      const text = spam.trapped
        ? await Promise.resolve('Merci.') // robot : succès simulé, rien n'est envoyé
        : await clientApi.subscribeNewsletter({
            email: parsed.data.email,
            consent: true,
            source,
            ...spam.payload(),
          });
      setMessage(text);
      form.reset();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      spam.reset();
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={(e) => void onSubmit(e)}
      onFocusCapture={() => setEngaged(true)}
      noValidate
      aria-label="Lettre d’information"
      className="flex flex-col gap-3"
    >
      <FormError message={formError} />
      <FormSuccess message={message} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          label="Votre adresse e-mail"
          name="email"
          type="email"
          autoComplete="email"
          error={errors.email}
          wrapperClassName="sm:flex-1"
          required
        />
        <Button type="submit" loading={busy} className="sm:mt-8">
          S’abonner
        </Button>
      </div>
      <Checkbox
        name="consent"
        error={errors.consent}
        label={
          <>
            J’accepte de recevoir la lettre d’information de ProtectIci. Je peux me désinscrire à
            tout moment (voir la <Link href="/confidentialite">politique de confidentialité</Link>).
          </>
        }
      />
      {engaged ? <AntiSpamFields spam={spam} /> : null}
    </form>
  );
}
