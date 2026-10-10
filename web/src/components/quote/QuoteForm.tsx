'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { QuoteReceipt, QuoteRequestInput, ReferenceData } from '@/lib/api/types';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { QUOTE_MAX_PROVIDERS, quoteSchema, todayIso } from '@/lib/wave-b-schemas';
import { ProviderPicker, type PickedProvider } from '../directory/ProviderPicker';
import { ErrorSummary } from '../establishment/ErrorSummary';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button, ButtonLink } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FieldError, FormError } from '../ui/Field';
import { Input } from '../ui/Input';
import { ReferenceCard } from '../ui/ReferenceCard';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { bodyFingerprint, useIdempotencyKey } from './use-idempotency';

const DESCRIPTION_MAX = 3000;

/** Normalise les clés d’erreur serveur (`provider_slugs.0` => `provider_slugs`). */
function normalizeServerFields(fields: Record<string, string>): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    const base = key.replace(/\.\d+$/, '');
    if (!(base in out)) out[base] = message;
  }
  return out;
}

export function QuoteForm({
  reference,
  initialProvider = null,
}: {
  reference: ReferenceData;
  initialProvider?: PickedProvider | null;
}) {
  const [receipt, setReceipt] = useState<{ data: QuoteReceipt; withProviders: boolean } | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (receipt) {
    return (
      <div className="flex flex-col gap-5">
        <ReferenceCard
          title="Votre demande de devis a bien été envoyée"
          reference={receipt.data.reference}
          message={receipt.data.message}
        />
        <p>
          {receipt.withProviders
            ? 'Votre demande sera transmise aux prestataires choisis.'
            : 'Votre demande sera examinée par notre équipe, qui l’acheminera vers les prestataires adaptés.'}{' '}
          Conservez votre numéro de référence.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/annuaire">Parcourir l’annuaire</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              setReceipt(null);
              setFormKey((n) => n + 1);
            }}
          >
            Faire une autre demande
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QuoteFields
      key={formKey}
      reference={reference}
      initialProvider={initialProvider}
      onSent={(data, withProviders) => setReceipt({ data, withProviders })}
    />
  );
}

function QuoteFields({
  reference,
  initialProvider,
  onSent,
}: {
  reference: ReferenceData;
  initialProvider: PickedProvider | null;
  onSent: (receipt: QuoteReceipt, withProviders: boolean) => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [signal, setSignal] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [cityId, setCityId] = useState('');
  const [description, setDescription] = useState('');
  const [providers, setProviders] = useState<PickedProvider[]>(initialProvider ? [initialProvider] : []);
  const spam = useAntiSpam();
  const idem = useIdempotencyKey();

  const districts = reference.cities.find((c) => String(c.id) === cityId)?.districts ?? [];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    setFormError(null);
    const parsed = validate(quoteSchema, {
      ...formToObject(e.currentTarget),
      provider_slugs: providers.map((p) => p.slug),
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setSignal((n) => n + 1);
      return;
    }
    setErrors({});
    if (!spam.ready) return setFormError(TURNSTILE_REQUIRED_MESSAGE);

    const d = parsed.data;
    const slugs = d.provider_slugs ?? [];
    const input: QuoteRequestInput = {
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone,
      ...(d.company_name ? { company_name: d.company_name } : {}),
      service_type_id: d.service_type_id,
      city_id: d.city_id,
      ...(d.district_id ? { district_id: d.district_id } : {}),
      description: d.description,
      ...(d.desired_start_date ? { desired_start_date: d.desired_start_date } : {}),
      ...(d.budget_range ? { budget_range: d.budget_range } : {}),
      ...(slugs.length ? { provider_slugs: slugs } : {}),
      consent: true,
      ...spam.payload(),
    };
    const key = idem.keyFor(bodyFingerprint({ ...input }));

    running.current = true;
    setBusy(true);
    try {
      const result = await clientApi.createQuoteRequest(input, key);
      idem.renew();
      onSent(result, slugs.length > 0);
    } catch (err) {
      const desc = describeError(err);
      const fields = normalizeServerFields(desc.fields);
      setErrors(fields);
      setFormError(desc.form);
      setSignal((n) => n + 1);
    } finally {
      spam.reset(); // un jeton Turnstile ne sert qu’une fois
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex max-w-3xl flex-col gap-8">
      <ErrorSummary errors={errors} focusSignal={signal} />
      <FormError message={formError} />

      <section aria-labelledby="quote-contact" className="flex flex-col gap-4">
        <h2 id="quote-contact" className="text-xl font-bold">
          Vos coordonnées
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" name="first_name" autoComplete="given-name" error={errors.first_name} required />
          <Input label="Nom" name="last_name" autoComplete="family-name" error={errors.last_name} required />
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
          label="Téléphone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+225 07 00 00 00 00"
          error={errors.phone}
          required
        />
        <Input
          label="Entreprise (facultatif)"
          name="company_name"
          autoComplete="organization"
          error={errors.company_name}
        />
      </section>

      <section aria-labelledby="quote-need" className="flex flex-col gap-4">
        <h2 id="quote-need" className="text-xl font-bold">
          Votre besoin
        </h2>
        <Select label="Service recherché" name="service_type_id" defaultValue="" error={errors.service_type_id} required>
          <option value="">Choisir un service</option>
          {reference.service_types.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Ville"
            name="city_id"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            error={errors.city_id}
            required
          >
            <option value="">Choisir une ville</option>
            {reference.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            key={cityId}
            label="Quartier (facultatif)"
            name="district_id"
            defaultValue=""
            disabled={!cityId}
            hint={!cityId ? 'Choisissez d’abord une ville.' : undefined}
            error={errors.district_id}
          >
            <option value="">Non précisé</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Description de votre besoin"
          name="description"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint={`Entre 20 et ${DESCRIPTION_MAX} caractères. ${description.length} / ${DESCRIPTION_MAX}`}
          error={errors.description}
          required
        />
        <Input
          label="Date de début souhaitée (facultatif)"
          name="desired_start_date"
          type="date"
          min={todayIso()}
          error={errors.desired_start_date}
        />
        <Input
          label="Budget indicatif (facultatif)"
          name="budget_range"
          maxLength={50}
          placeholder="Ex. : 300 000 FCFA par mois"
          error={errors.budget_range}
        />
      </section>

      <section aria-labelledby="quote-providers" className="flex flex-col gap-3">
        <h2 id="quote-providers" className="text-xl font-bold">
          Prestataires souhaités
        </h2>
        <ProviderPicker
          selected={providers}
          onChange={setProviders}
          max={QUOTE_MAX_PROVIDERS}
          hint={`Facultatif : choisissez jusqu’à ${QUOTE_MAX_PROVIDERS} prestataires. Sans choix, notre équipe acheminera votre demande.`}
        />
        <FieldError id="quote-providers-error" message={errors.provider_slugs} />
      </section>

      <section aria-labelledby="quote-consent" className="flex flex-col gap-4">
        <h2 id="quote-consent" className="text-xl font-bold">
          Consentement
        </h2>
        <Checkbox
          name="consent"
          error={errors.consent}
          label={
            <>
              J’accepte que mes informations soient transmises aux prestataires concernés et traitées pour
              répondre à ma demande, conformément à la{' '}
              <Link href="/confidentialite">politique de confidentialité</Link>.
            </>
          }
        />
        <AntiSpamFields spam={spam} />
        <div>
          <Button type="submit" size="lg" loading={busy}>
            Envoyer ma demande
          </Button>
        </div>
      </section>
    </form>
  );
}
