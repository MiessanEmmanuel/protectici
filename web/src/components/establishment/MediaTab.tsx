'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { EstablishmentMedia, MediaCollection } from '@/lib/api/types';
import { formatBytes, IMAGE_RULES } from '@/lib/files';
import { COLLECTION_LABELS } from '@/lib/labels';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormError, FormSuccess } from '../ui/Field';
import { FileInput } from '../ui/FileInput';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import type { TabProps } from './manager-types';

const LIMITS: Record<MediaCollection, number> = { logo: 1, cover: 1, gallery: 10 };
const ORDER: MediaCollection[] = ['logo', 'cover', 'gallery'];

export function MediaTab(props: TabProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p className="text-muted">
        Formats acceptés : {IMAGE_RULES.typesLabel}, {formatBytes(IMAGE_RULES.maxBytes)} maximum. Les
        images sont recompressées et les données de localisation (EXIF) sont supprimées. Le texte
        alternatif décrit l’image pour les personnes qui ne la voient pas : il est obligatoire.
      </p>
      {ORDER.map((c) => (
        <MediaSection key={c} collection={c} {...props} />
      ))}
    </div>
  );
}

function MediaSection({ collection, est, readOnly, reload }: TabProps & { collection: MediaCollection }) {
  const items = est.media.filter((m) => m.collection === collection);
  const limit = LIMITS[collection];
  const full = items.length >= limit;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [altError, setAltError] = useState<string | undefined>();
  const [resetKey, setResetKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EstablishmentMedia | null>(null);
  const { run, busy } = useAsyncAction();
  const toast = useToast();
  const label = COLLECTION_LABELS[collection];
  const headingId = `media-${collection}`;

  async function submit() {
    setMessage(null);
    setFormError(null);
    setAltError(undefined);
    if (!file) {
      setFileError('Choisissez une image.');
      return;
    }
    if (alt.trim() === '') {
      setAltError('Le texte alternatif est obligatoire.');
      return;
    }
    if (alt.trim().length > 255) {
      setAltError('Le texte alternatif est trop long (255 caractères maximum).');
      return;
    }
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.uploadMedia(est.type, est.slug, { file, collection, alt: alt.trim() });
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      setFile(null);
      setAlt('');
      setFileError(null);
      setResetKey((k) => k + 1);
      setMessage(`Image ajoutée : ${label.toLowerCase()}.`);
      toast.show('Image ajoutée.', 'success');
      reload();
    } else if (caught !== null) {
      const d = describeError(caught);
      setAltError(d.fields.alt);
      setFileError(d.fields.file ?? d.fields.collection ?? null);
      setFormError(d.form);
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="text-lg font-semibold">
        {label} <span className="text-sm font-normal text-muted">({items.length}/{limit})</span>
      </h3>
      {items.length === 0 ? <p className="text-muted">Aucune image.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2" aria-label={label}>
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt} className="max-h-48 w-full rounded-md object-contain" />
            <p className="mt-2 text-sm text-muted">Texte alternatif : {m.alt}</p>
            {readOnly ? null : (
              <Button
                variant="ghost"
                aria-label={`Supprimer l’image : ${m.alt}`}
                onClick={() => setToDelete(m)}
              >
                Supprimer
              </Button>
            )}
          </li>
        ))}
      </ul>
      {readOnly ? null : full ? (
        <p className="text-sm text-muted">
          {collection === 'gallery'
            ? 'La galerie est pleine (10 images).'
            : 'Une seule image est autorisée : supprimez l’actuelle pour la remplacer.'}
        </p>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormError message={formError} />
          <FormSuccess message={message} />
          <FileInput
            rules={IMAGE_RULES}
            label={`Ajouter une image (${label.toLowerCase()})`}
            error={fileError ?? undefined}
            disabled={busy}
            resetKey={resetKey}
            onChange={(f, err) => {
              setFile(f);
              setFileError(err);
            }}
          />
          <Input
            label="Texte alternatif"
            required
            value={alt}
            maxLength={255}
            onChange={(e) => setAlt(e.target.value)}
            error={altError}
            hint="Décrivez l’image en une phrase courte."
            disabled={busy}
          />
          <div>
            <Button type="submit" loading={busy}>
              Envoyer l’image
            </Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer cette image ?"
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={async () => {
          if (!toDelete) return;
          await clientApi.deleteMedia(est.type, est.slug, toDelete.id);
          toast.show('Image supprimée.', 'success');
          setMessage('Image supprimée.');
          reload();
        }}
      >
        <p>L’image sera retirée de la fiche. Cette action est définitive.</p>
      </ConfirmDialog>
    </section>
  );
}
