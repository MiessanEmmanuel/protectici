'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { useResource } from '@/lib/use-async';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { useToast } from '../../ui/Toast';
import { AdminPageHeader } from '../AdminPageHeader';
import { FormSection } from './AdminKit';

const LABELS: Record<string, string> = {
  'contact.phone': 'Téléphone',
  'contact.email': 'E-mail de contact',
  'contact.notification_email': 'E-mail de notification interne',
  'site.address': 'Adresse du siège',
  'social.facebook': 'Page Facebook',
  'social.linkedin': 'Page LinkedIn',
  'site.name': 'Nom du site',
  'site.tagline': 'Slogan',
  'social.twitter': 'Compte X (Twitter)',
  'social.instagram': 'Compte Instagram',
  'social.youtube': 'Chaîne YouTube',
  'social.tiktok': 'Compte TikTok',
  'social.whatsapp': 'WhatsApp',
};

/** Paramètres du site (clés en liste blanche côté API ; les valeurs publiques alimentent pied de page et contact). */
export function AdminSettingsView() {
  const state = useResource(() => clientApi.adminGetSettings(), []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const toast = useToast();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current || !state.data) return;
    const fd = new FormData(e.currentTarget);
    const next = state.data.map((s) => ({
      key: s.key,
      value: String(fd.get(`v:${s.key}`) ?? '').trim() || null,
      is_public: fd.get(`p:${s.key}`) === 'on',
    }));
    const bad: Record<string, string> = {};
    for (const s of next) {
      if (s.key.startsWith('social.') && s.value && !/^https?:\/\/\S+$/i.test(s.value)) {
        bad[s.key] = "L'adresse doit commencer par http:// ou https://.";
      }
      if (s.key.endsWith('email') && s.value && !/^\S+@\S+\.\S+$/.test(s.value)) {
        bad[s.key] = "L'adresse e-mail n'est pas valide.";
      }
    }
    setErrors(bad);
    if (Object.keys(bad).length) return;
    setFormError(null);
    running.current = true;
    setBusy(true);
    try {
      state.setData(await clientApi.adminUpdateSettings(next));
      toast.show('Paramètres enregistrés.', 'success');
    } catch (err) {
      setFormError(describeError(err).form);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Site" title="Paramètres du site" />
      <QueryBoundary state={state} loadingLabel="Chargement des paramètres…">
        {(settings) => (
          <form method="post" onSubmit={(e) => void submit(e)} noValidate className="flex max-w-2xl flex-col gap-5">
            <FormError message={formError} />
            {settings.map((s) => (
              <FormSection key={s.key} legend={LABELS[s.key] ?? s.key}>
                <Input label="Valeur" name={`v:${s.key}`} defaultValue={s.value ?? ''} maxLength={255} error={errors[s.key]} />
                <Checkbox name={`p:${s.key}`} label="Afficher publiquement sur le site" defaultChecked={s.is_public} />
              </FormSection>
            ))}
            <div><Button type="submit" loading={busy}>Enregistrer</Button></div>
          </form>
        )}
      </QueryBoundary>
    </div>
  );
}
