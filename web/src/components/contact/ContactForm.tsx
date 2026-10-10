'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { ContactInput } from '@/lib/api/types';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { contactSchema } from '@/lib/wave-b-schemas';
import { ErrorSummary } from '../establishment/ErrorSummary';
import { bodyFingerprint, useIdempotencyKey } from '../quote/use-idempotency';
import { AntiSpamFields } from '../security/AntiSpamFields';
import { TURNSTILE_REQUIRED_MESSAGE, useAntiSpam } from '../security/use-anti-spam';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { FormError } from '../ui/Field';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

const MESSAGE_MAX = 5000;

export function ContactForm() {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (confirmation !== null) {
    return (
      <Confirmation
        message={confirmation}
        onAnother={() => {
          setConfirmation(null);
          setFormKey((n) => n + 1);
        }}
      />
    );
  }
  return <ContactFields key={formKey} onSent={setConfirmation} />;
}

function Confirmation({ message, onAnother }: { message: string; onAnother: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        className="rounded-md border border-success bg-success-soft p-4 font-semibold text-success outline-none"
      >
        <p className="whitespace-pre-line">{message}</p>
      </div>
      <div>
        <Button variant="secondary" onClick={onAnother}>
          Envoyer un autre message
        </Button>
      </div>
    </div>
  );
}

function ContactFields({ onSent }: { onSent: (message: string) => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [signal, setSignal] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [message, setMessage] = useState('');
  const spam = useAntiSpam();
  const idem = useIdempotencyKey();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    setFormError(null);
    const parsed = validate(contactSchema, formToObject(e.currentTarget));
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setSignal((n) => n + 1);
      return;
    }
    setErrors({});
    if (!spam.ready) return setFormError(TURNSTILE_REQUIRED_MESSAGE);

    const input: ContactInput = {
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      consent: true,
      ...spam.payload(),
    };
    const key = idem.keyFor(bodyFingerprint({ ...input }));

    running.current = true;
    setBusy(true);
    try {
      const text = await clientApi.sendContact(input, key);
      idem.renew();
      onSent(text);
    } catch (err) {
      const desc = describeError(err);
      setErrors(desc.fields);
      setFormError(desc.form);
      setSignal((n) => n + 1);
    } finally {
      spam.reset();
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <ErrorSummary errors={errors} focusSignal={signal} />
      <FormError message={formError} />
      <Input label="Nom" name="name" autoComplete="name" error={errors.name} required />
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        error={errors.email}
        required
      />
      <Input label="Objet" name="subject" error={errors.subject} required />
      <Textarea
        label="Message"
        name="message"
        rows={7}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        hint={`Entre 10 et ${MESSAGE_MAX} caractères. ${message.length} / ${MESSAGE_MAX}`}
        error={errors.message}
        required
      />
      <Checkbox
        name="consent"
        error={errors.consent}
        label={
          <>
            J’accepte que mes informations soient traitées pour répondre à mon message, conformément à la{' '}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </>
        }
      />
      <AntiSpamFields spam={spam} />
      <div>
        <Button type="submit" loading={busy}>
          Envoyer le message
        </Button>
      </div>
    </form>
  );
}
