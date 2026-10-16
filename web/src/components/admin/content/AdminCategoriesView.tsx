'use client';

import { useRef, useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { ContentCategory } from '@/lib/api/types';
import { categoryFormSchema } from '@/lib/content-schemas';
import { useResource } from '@/lib/use-async';
import { formToObject, validate, type FieldErrors } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Checkbox } from '../../ui/Checkbox';
import { FormError } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Textarea } from '../../ui/Textarea';
import { useToast } from '../../ui/Toast';
import { AdminPageHeader } from '../AdminPageHeader';

/** Catégories du blog : renommage, description, ordre et visibilité (pas de création : référentiel fixe de 7). */
export function AdminCategoriesView() {
  const list = useResource(() => clientApi.contentListCategories(), []);
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Contenu" title="Catégories du blog" />
      <QueryBoundary state={list} loadingLabel="Chargement des catégories…">
        {(cats) => (
          <ul className="flex flex-col gap-4">
            {cats.map((c) => (
              <li key={c.id}>
                <CategoryForm category={c} onSaved={list.reload} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </div>
  );
}

function CategoryForm({ category, onSaved }: { category: ContentCategory; onSaved: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const toast = useToast();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running.current) return;
    const parsed = validate(categoryFormSchema, formToObject(e.currentTarget));
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setFormError(null);
    running.current = true;
    setBusy(true);
    try {
      await clientApi.contentUpdateCategory(category.id, parsed.data);
      toast.show(`Catégorie « ${parsed.data.name} » enregistrée.`, 'success');
      onSaved();
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
    <Card as="section" aria-label={category.name}>
      <form method="post" onSubmit={(e) => void submit(e)} noValidate className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <FormError message={formError} />
        <Input label="Nom" name="name" defaultValue={category.name} maxLength={80} required error={errors.name} />
        <Input label="Ordre d’affichage" name="sort_order" type="number" min={0} defaultValue={category.sort_order} error={errors.sort_order} />
        <Textarea label="Description" name="description" defaultValue={category.description ?? ''} rows={2} maxLength={300} wrapperClassName="sm:col-span-2" error={errors.description} />
        <Checkbox name="is_visible" label="Visible sur le site" defaultChecked={category.is_visible} />
        <p className="text-sm text-muted sm:text-right">{category.posts_count} article(s)</p>
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy}>Enregistrer</Button>
        </div>
      </form>
    </Card>
  );
}
