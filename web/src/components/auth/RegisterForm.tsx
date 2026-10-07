'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { formToObject, registerSchema, validate, type FieldErrors } from '@/lib/validation';
import { useSession } from '../layout/SessionProvider';
import { Button, ButtonLink } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function RegisterForm() {
  const { setUser } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // Clé d'idempotence générée une fois par formulaire : un renvoi réseau ne crée pas deux comptes.
  const idempotencyKey = useRef<string>(typeof crypto !== 'undefined' ? crypto.randomUUID() : '');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = validate(registerSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      const { phone, ...rest } = parsed.data;
      const user = await clientApi.register(
        { ...rest, ...(phone ? { phone } : {}) },
        idempotencyKey.current || undefined,
      );
      setUser(user);
      setDone(true);
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess message="Votre compte a été créé. Un e-mail de vérification vous a été envoyé : cliquez sur le lien qu’il contient pour pouvoir ajouter des favoris et publier des avis." />
        <ButtonLink href="/compte">Accéder à mon compte</ButtonLink>
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
