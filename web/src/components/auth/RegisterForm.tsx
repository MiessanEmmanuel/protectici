'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError, errorMessage } from '@/lib/api/errors';
import type { RegisterInput } from '@/lib/api/endpoints';
import { USE_MOCKS } from '@/lib/env';
import { mockClickVerificationLink } from '@/lib/mocks/mock-api';
import { formToObject, registerSchema, validate, type FieldErrors } from '@/lib/validation';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';

export const RESEND_DELAY_S = 60;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sentTo) titleRef.current?.focus();
  }, [sentTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = validate(registerSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      const { phone, ...rest } = parsed.data;
      const input: RegisterInput = { ...rest, ...(phone ? { phone } : {}) };
      await clientApi.register(input, crypto.randomUUID());
      // Seul l'e-mail est conservé (pour le renvoi) : le mot de passe n'est plus en mémoire.
      setSentTo(input.email);
      setResendIn(RESEND_DELAY_S);
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!sentTo || resendIn > 0) return;
    setBusy(true);
    setResendNotice(null);
    try {
      setResendNotice(await clientApi.resendVerificationPublic(sentTo));
      setResendIn(RESEND_DELAY_S);
    } catch (err) {
      setResendNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h2 ref={titleRef} tabIndex={-1} className="text-lg font-bold outline-none">
          Vérifiez votre boîte e-mail
        </h2>
        <p role="status">
          Si cette adresse est valide, vous allez recevoir un e-mail pour activer votre compte.
          Consultez votre boîte de réception et vos courriers indésirables. Le lien est valable 60
          minutes.
        </p>
        <p aria-live="polite" role="status" className="min-h-6 text-sm">
          {resendNotice}
        </p>
        <Button
          variant="secondary"
          onClick={() => void resend()}
          disabled={resendIn > 0}
          loading={busy}
        >
          {resendIn > 0 ? `Renvoyer l’e-mail (dans ${resendIn} s)` : 'Renvoyer l’e-mail'}
        </Button>
        {USE_MOCKS ? (
          <Button
            variant="ghost"
            onClick={() => {
              mockClickVerificationLink();
              router.push('/compte?verified=1');
            }}
          >
            Démo : simuler le clic sur le lien reçu par e-mail
          </Button>
        ) : null}
        <p className="text-center text-sm">
          <Link href="/connexion">Aller à la connexion</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          name="first_name"
          autoComplete="given-name"
          error={errors.first_name}
          required
        />
        <Input
          label="Nom"
          name="last_name"
          autoComplete="family-name"
          error={errors.last_name}
          required
        />
      </div>
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
        required
      />
      <Input
        label="Téléphone (facultatif)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+225 07 00 00 00 00"
        error={errors.phone}
      />
      <Input
        label="Mot de passe"
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
      <Checkbox
        name="consent"
        error={errors.consent}
        label={
          <>
            J’accepte que mes données soient traitées pour la gestion de mon compte, conformément à
            la <Link href="/confidentialite">politique de confidentialité</Link> (bientôt
            disponible).
          </>
        }
      />
      <Button type="submit" loading={busy}>
        Créer mon compte
      </Button>
    </form>
  );
}
