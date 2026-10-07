'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError, errorMessage } from '@/lib/api/errors';
import type { TwoFactorEnable, User } from '@/lib/api/types';
import {
  disableTwoFactorSchema,
  formToObject,
  totpCodeSchema,
  validate,
  type FieldErrors,
} from '@/lib/validation';
import { useSession } from '../layout/SessionProvider';
import { Button } from '../ui/Button';
import { FormError, FormSuccess } from '../ui/Field';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Tag';

type Phase = 'idle' | 'setup' | 'codes';

export function TwoFactorSection({ user }: { user: User }) {
  const { refresh } = useSession();
  const [phase, setPhase] = useState<Phase>('idle');
  const [setup, setSetup] = useState<TwoFactorEnable | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disabledMsg, setDisabledMsg] = useState(false);

  async function start() {
    setBusy(true);
    setFormError(null);
    try {
      setSetup(await clientApi.enableTwoFactor());
      setPhase('setup');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = validate(totpCodeSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      setCodes(await clientApi.confirmTwoFactor(parsed.data.code));
      setPhase('codes');
      await refresh();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = validate(disableTwoFactorSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setBusy(true);
    try {
      await clientApi.disableTwoFactor(parsed.data.password);
      setDisabledMsg(true);
      await refresh();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      setBusy(false);
    }
  }

  const mandatory = user.role === 'admin' || user.role === 'editor';

  if (phase === 'codes') {
    return (
      <div className="flex flex-col gap-3">
        <FormSuccess message="La vérification en deux étapes est activée." />
        <p className="font-semibold">Conservez ces codes de secours dans un endroit sûr.</p>
        <p className="text-sm text-muted">
          Chaque code ne sert qu’une fois. Ils ne seront plus affichés.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono sm:grid-cols-4">
          {codes.map((c) => (
            <li
              key={c}
              className="rounded-md border border-line bg-surface-alt px-2 py-1 text-center"
            >
              {c}
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" onClick={() => setPhase('idle')}>
            J’ai noté mes codes
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'setup' && setup) {
    return (
      <form onSubmit={(e) => void confirm(e)} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Scannez ce code avec votre application d’authentification (Google Authenticator, Aegis,
            etc.).
          </li>
          <li>Saisissez le code à 6 chiffres qu’elle affiche pour confirmer.</li>
        </ol>
        {/* SVG fourni par l'API, affiché comme image (data URI) : les scripts éventuels ne s'exécutent pas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr_svg)}`}
          alt="QR code à scanner avec votre application d’authentification"
          width={200}
          height={200}
          className="rounded-md border border-line bg-surface p-2"
        />
        <p className="text-sm">
          Impossible de scanner ? Saisissez cette clé manuellement :{' '}
          <code className="rounded bg-surface-alt px-1 font-mono">{setup.secret}</code>
        </p>
        <Input
          label="Code à 6 chiffres"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          error={errors.code}
          required
        />
        <div className="flex gap-3">
          <Button type="submit" loading={busy}>
            Confirmer et activer
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setPhase('idle');
              setSetup(null);
              setErrors({});
            }}
          >
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  if (user.two_factor_enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p>
          <Badge tone="success">✓ Activée</Badge>
        </p>
        {mandatory ? (
          <p className="text-muted">
            La vérification en deux étapes est obligatoire pour votre rôle.
          </p>
        ) : (
          <form onSubmit={(e) => void disable(e)} noValidate className="flex flex-col gap-3">
            <FormError message={formError} />
            <Input
              label="Mot de passe (pour désactiver)"
              name="password"
              type="password"
              autoComplete="current-password"
              error={errors.password}
              required
            />
            <div>
              <Button type="submit" variant="danger" loading={busy}>
                Désactiver la 2FA
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSuccess
        message={disabledMsg ? 'La vérification en deux étapes a été désactivée.' : null}
      />
      <p>
        <Badge>Non activée</Badge>
      </p>
      <p className="text-muted">
        {mandatory
          ? 'La vérification en deux étapes est obligatoire pour votre rôle : activez-la pour accéder à l’administration.'
          : 'Ajoutez une protection supplémentaire à votre compte avec une application d’authentification.'}
      </p>
      <FormError message={formError} />
      <div>
        <Button onClick={() => void start()} loading={busy}>
          Activer la 2FA
        </Button>
      </div>
    </div>
  );
}
