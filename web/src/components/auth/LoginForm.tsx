'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { safeRedirect } from '@/lib/safe-redirect';
import {
  formToObject,
  loginSchema,
  twoFactorSchema,
  validate,
  type FieldErrors,
} from '@/lib/validation';
import { useSession } from '../layout/SessionProvider';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';

export function LoginForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const { setUser } = useSession();
  const [step, setStep] = useState<'credentials' | 'two_factor'>('credentials');
  const [useRecovery, setUseRecovery] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = safeRedirect(redirect, '/compte');

  function fail(e: unknown) {
    const d = describeError(e);
    setErrors(d.fields);
    setFormError(d.form);
  }

  async function onCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = validate(loginSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      const res = await clientApi.login({
        email: parsed.data.email,
        password: parsed.data.password,
        remember: parsed.data.remember,
      });
      if (res.kind === 'two_factor') {
        setStep('two_factor');
      } else {
        setUser(res.user);
        router.push(target);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onTwoFactor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const code = String(formToObject(e.currentTarget).code ?? '').trim();
    if (useRecovery) {
      if (!code) return setErrors({ code: 'Saisissez un code de secours.' });
    } else {
      const parsed = validate(twoFactorSchema, { code });
      if (!parsed.ok) return setErrors(parsed.errors);
    }
    const input = useRecovery ? { recovery_code: code } : { code };
    setErrors({});
    setBusy(true);
    try {
      const user = await clientApi.twoFactorChallenge(input);
      setUser(user);
      router.push(target);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'two_factor') {
    return (
      <form onSubmit={(e) => void onTwoFactor(e)} noValidate className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Vérification en deux étapes</h2>
        <p className="text-muted">
          {useRecovery
            ? 'Saisissez l’un de vos codes de secours.'
            : 'Saisissez le code à 6 chiffres affiché par votre application d’authentification.'}
        </p>
        <FormError message={formError} />
        <Input
          autoFocus
          label={useRecovery ? 'Code de secours' : 'Code à 6 chiffres'}
          name="code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useRecovery ? 32 : 6}
          error={errors.code ?? errors.recovery_code}
          required
        />
        <Button type="submit" loading={busy}>
          Valider
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setUseRecovery((v) => !v);
            setErrors({});
            setFormError(null);
          }}
        >
          {useRecovery ? 'Utiliser le code de mon application' : 'Utiliser un code de secours'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void onCredentials(e)} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
        required
      />
      <Input
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
        required
      />
      <Checkbox label="Rester connecté" name="remember" />
      <Button type="submit" loading={busy}>
        Se connecter
      </Button>
      <p className="text-center text-sm">
        <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
      </p>
    </form>
  );
}
