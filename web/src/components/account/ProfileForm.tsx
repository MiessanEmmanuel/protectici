'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { User } from '@/lib/api/types';
import { formToObject, profileSchema, validate, type FieldErrors } from '@/lib/validation';
import { useSession } from '../layout/SessionProvider';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';

export function ProfileForm({ user }: { user: User }) {
  const { setUser } = useSession();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setFormError(null);
    const parsed = validate(profileSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      const updated = await clientApi.updateProfile({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        phone: parsed.data.phone ? parsed.data.phone : null,
      });
      setUser(updated);
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
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <FormSuccess message={saved ? 'Vos informations ont été enregistrées.' : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          name="first_name"
          defaultValue={user.first_name}
          autoComplete="given-name"
          error={errors.first_name}
          required
        />
        <Input
          label="Nom"
          name="last_name"
          defaultValue={user.last_name}
          autoComplete="family-name"
          error={errors.last_name}
          required
        />
      </div>
      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        defaultValue={user.phone ?? ''}
        autoComplete="tel"
        error={errors.phone}
      />
      <div>
        <Button type="submit" loading={busy}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
