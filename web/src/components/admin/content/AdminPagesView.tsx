'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import { pageFormSchema } from '@/lib/content-schemas';
import { sanitizeEditorHtml } from '@/lib/sanitize-html';
import { useResource } from '@/lib/use-async';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { useSession } from '../../layout/SessionProvider';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { RichTextEditor } from './RichTextEditor';
import { AdminPageHeader } from '../AdminPageHeader';

const PAGES = [
  { slug: 'qui-sommes-nous', label: 'Qui sommes-nous' },
  { slug: 'mentions-legales', label: 'Mentions légales' },
  { slug: 'confidentialite', label: 'Politique de confidentialité' },
  { slug: 'cgu', label: 'Conditions générales d’utilisation' },
] as const;

/** Pages institutionnelles : lecture seule pour `editor`, modification réservée à `admin` (contrat §9.2). */
export function AdminPagesView() {
  const [slug, setSlug] = useState<string>(PAGES[0].slug);
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Contenu" title="Pages institutionnelles" />
      <Select label="Page" value={slug} onChange={(e) => setSlug(e.target.value)} wrapperClassName="sm:w-80">
        {PAGES.map((p) => (
          <option key={p.slug} value={p.slug}>{p.label}</option>
        ))}
      </Select>
      <PageEditor key={slug} slug={slug} />
    </div>
  );
}

function PageEditor({ slug }: { slug: string }) {
  const { user } = useSession();
  const canEdit = user?.role === 'admin';
  const state = useResource(() => clientApi.contentGetPage(slug), [slug]);
  const [body, setBody] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const toast = useToast();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current || !state.data) return;
    const html = sanitizeEditorHtml(body ?? state.data.body);
    const parsed = validate(pageFormSchema, { ...formToObject(e.currentTarget), body: html });
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setFormError(null);
    running.current = true;
    setBusy(true);
    try {
      await clientApi.contentUpdatePage(slug, parsed.data);
      toast.show('Page enregistrée.', 'success');
      state.reload();
    } catch (err) {
      const d = describeError(err);
      setErrors(d.fields);
      setFormError(d.form);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <QueryBoundary state={state} loadingLabel="Chargement de la page…">
      {(page) =>
        canEdit ? (
          <form method="post" onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
            <FormError message={formError} />
            <Input label="Titre" name="title" defaultValue={page.title} maxLength={160} required error={errors.title} />
            <RichTextEditor label="Contenu" value={page.body} onChange={setBody} error={errors.body} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Titre SEO" name="seo_title" defaultValue={page.seo_title ?? ''} maxLength={70} error={errors.seo_title} />
              <Input label="Description SEO" name="seo_description" defaultValue={page.seo_description ?? ''} maxLength={160} error={errors.seo_description} />
            </div>
            <Checkbox name="is_visible" label="Page visible sur le site" defaultChecked={page.is_visible} />
            <div><Button type="submit" loading={busy}>Enregistrer</Button></div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="border-2 border-ink bg-c4 p-3">
              Lecture seule : la modification des pages institutionnelles est réservée aux administrateurs.
            </p>
            <h2 className="text-xl heading-block">{page.title}</h2>
            <p className="text-sm text-muted">{page.seo_description ?? 'Aucune description SEO.'}</p>
          </div>
        )
      }
    </QueryBoundary>
  );
}
