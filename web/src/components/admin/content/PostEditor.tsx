'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { ContentPost, ContentPostInput, PostCategory } from '@/lib/api/types';
import { isoToLocalInput, localInputToIso, postFormSchema } from '@/lib/content-schemas';
import { IMAGE_RULES } from '@/lib/files';
import { sanitizeEditorHtml } from '@/lib/sanitize-html';
import { useResource } from '@/lib/use-async';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { SanitizedHtml } from '../../content/SanitizedHtml';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { FileInput } from '../../ui/FileInput';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';
import { useToast } from '../../ui/Toast';
import { POST_STATUS_LABELS } from './labels';
import { RichTextEditor } from './RichTextEditor';
import { AdminPageHeader } from '../AdminPageHeader';

type Cover = { id: number; url: string; alt: string | null } | null;

/** Création / édition d'un article : brouillon, planification, publication, aperçu, couverture. */
export function PostEditor({ post }: { post?: ContentPost }) {
  const cats = useResource(() => clientApi.listBlogCategories(), []);
  const catIds = useResource(() => clientApi.contentListCategories(), []);
  return (
    <QueryBoundary state={cats} loadingLabel="Chargement…">
      {(categories) => (
        <QueryBoundary state={catIds}>
          {(ids) => (
            <PostForm
              post={post}
              categories={categories.map((c) => ({
                ...c,
                id: ids.find((i) => i.slug === c.slug)?.id ?? 0,
              }))}
            />
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function PostForm({ post, categories }: { post?: ContentPost; categories: (PostCategory & { id: number })[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState(post?.body ?? '');
  const [status, setStatus] = useState(post?.status ?? 'draft');
  const [cover, setCover] = useState<Cover>(post?.cover ?? null);
  const [coverAlt, setCoverAlt] = useState(post?.cover?.alt ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    setFormError(null);
    const raw = { ...formToObject(e.currentTarget), body: sanitizeEditorHtml(body) };
    const parsed = validate(postFormSchema, raw);
    if (!parsed.ok) return setErrors(parsed.errors);
    if (coverError) return;
    if (coverFile && !coverAlt.trim()) return setErrors({ cover_alt: 'Le texte alternatif de la couverture est requis.' });
    setErrors({});
    running.current = true;
    setBusy(true);
    try {
      let coverId = cover?.id ?? null;
      if (coverFile) {
        const media = await clientApi.contentUploadMedia(coverFile, coverAlt.trim());
        coverId = media.id;
        setCover(media);
        setCoverFile(null);
      }
      const d = parsed.data;
      const input: ContentPostInput = {
        title: d.title,
        category_id: d.category_id,
        excerpt: d.excerpt,
        body: d.body,
        status: d.status,
        published_at: localInputToIso(d.published_at),
        is_featured: d.is_featured,
        is_flash: d.is_flash,
        seo_title: d.seo_title,
        seo_description: d.seo_description,
        cover_media_id: coverId,
      };
      if (post) {
        await clientApi.contentUpdatePost(post.id, input);
        toast.show('Article enregistré.', 'success');
      } else {
        const created = await clientApi.contentCreatePost(input);
        toast.show('Article créé.', 'success');
        router.replace(`/admin/blog/${created.id}`);
      }
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
    <form method="post" onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
      <AdminPageHeader section="Contenu" title={post ? 'Modifier l’article' : 'Nouvel article'} />
      <FormError message={formError} />
      <Input label="Titre" name="title" defaultValue={post?.title} maxLength={160} required error={errors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Catégorie" name="category_id" defaultValue={post?.category.id ?? ''} required error={errors.category_id}>
          <option value="">Choisir…</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select label="Statut" name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} error={errors.status}>
          {Object.entries(POST_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>
      {status === 'scheduled' || status === 'published' ? (
        <Input
          label="Date de publication (heure d’Abidjan)"
          name="published_at"
          type="datetime-local"
          defaultValue={isoToLocalInput(post?.published_at)}
          hint={status === 'scheduled' ? 'Obligatoire : l’article sera publié automatiquement à cette date.' : 'Laissez vide pour publier immédiatement.'}
          error={errors.published_at}
        />
      ) : (
        <input type="hidden" name="published_at" value="" />
      )}
      <Textarea label="Résumé" name="excerpt" defaultValue={post?.excerpt ?? ''} maxLength={300} rows={3} error={errors.excerpt} />
      <RichTextEditor label="Contenu" value={post?.body ?? ''} onChange={setBody} error={errors.body} />
      <fieldset className="flex flex-col gap-3 border-2 border-ink p-4">
        <legend className="px-1 font-semibold">Image de couverture</legend>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={cover.alt ?? ''} width={320} height={180} className="aspect-video w-80 max-w-full object-cover" />
        ) : null}
        <FileInput
          label={cover ? 'Remplacer la couverture' : 'Ajouter une couverture'}
          rules={IMAGE_RULES}
          onChange={(f, err) => {
            setCoverFile(f);
            setCoverError(err);
          }}
          error={coverError ?? undefined}
        />
        <Input label="Texte alternatif de la couverture" value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} maxLength={200} error={errors.cover_alt} />
      </fieldset>
      <div className="flex flex-col gap-1">
        <Checkbox name="is_featured" label="Article à la une" defaultChecked={post?.is_featured} />
        <Checkbox name="is_flash" label="Afficher dans le bandeau Flash info" defaultChecked={post?.is_flash} />
      </div>
      <fieldset className="grid gap-4 border-2 border-ink p-4 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Référencement</legend>
        <Input label="Titre SEO" name="seo_title" defaultValue={post?.seo_title ?? ''} maxLength={70} error={errors.seo_title} />
        <Input label="Description SEO" name="seo_description" defaultValue={post?.seo_description ?? ''} maxLength={160} error={errors.seo_description} />
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>Enregistrer</Button>
        <Button type="button" variant="secondary" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
          {preview ? 'Masquer l’aperçu' : 'Aperçu'}
        </Button>
      </div>
      {preview ? (
        <Card as="section" aria-label="Aperçu de l’article">
          {/* Aperçu local : HTML filtré par la liste blanche du contrat (l'API refait l'assainissement à l'enregistrement). */}
          <SanitizedHtml html={sanitizeEditorHtml(body)} />
        </Card>
      ) : null}
    </form>
  );
}
