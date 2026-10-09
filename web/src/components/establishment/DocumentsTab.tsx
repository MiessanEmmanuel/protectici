'use client';

import { useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { describeError } from '@/lib/api/errors';
import type { DocumentType, EstablishmentDocument } from '@/lib/api/types';
import { DOCUMENT_RULES, formatBytes, MAX_DOCUMENTS } from '@/lib/files';
import { formatDate } from '@/lib/format';
import { DOCUMENT_TYPE_LABELS } from '@/lib/labels';
import { useAsyncAction } from '@/lib/use-async';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormError, FormSuccess } from '../ui/Field';
import { FileInput } from '../ui/FileInput';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Tag';
import { useToast } from '../ui/Toast';
import type { TabProps } from './manager-types';

/**
 * Justificatifs : stockage privé, jamais de lien de téléchargement côté propriétaire
 * (seule l'équipe y accède, chaque accès est journalisé).
 */
export function DocumentsTab({ est, readOnly, reload }: TabProps) {
  const docs = est.documents;
  const full = docs.length >= MAX_DOCUMENTS;
  const [docType, setDocType] = useState<DocumentType>('rccm_extract');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<EstablishmentDocument | null>(null);
  const { run, busy } = useAsyncAction();
  const toast = useToast();

  async function submit() {
    setMessage(null);
    setFormError(null);
    if (!file) {
      setFileError('Choisissez un fichier.');
      return;
    }
    let caught: unknown = null;
    const result = await run(async () => {
      try {
        return await clientApi.uploadDocument(est.type, est.slug, file, docType);
      } catch (e) {
        caught = e;
        throw e;
      }
    });
    if (result.ok) {
      setFile(null);
      setFileError(null);
      setResetKey((k) => k + 1);
      setMessage('Justificatif envoyé.');
      toast.show('Justificatif envoyé.', 'success');
      reload();
    } else if (caught !== null) {
      const d = describeError(caught);
      setFileError(d.fields.file ?? d.fields.type ?? null);
      setFormError(d.form);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="rounded-md bg-surface-alt p-3 text-sm text-muted">
        Vos justificatifs sont stockés de façon privée. Seule notre équipe de vérification peut les
        consulter ; ils ne sont jamais publiés et ne peuvent pas être téléchargés depuis cette page.
      </p>
      <section aria-labelledby="docs-title">
        <h3 id="docs-title" className="text-lg font-semibold">
          Justificatifs envoyés{' '}
          <span className="text-sm font-normal text-muted">
            ({docs.length}/{MAX_DOCUMENTS})
          </span>
        </h3>
        {docs.length === 0 ? (
          <p className="mt-2 text-muted">Aucun justificatif pour le moment.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3" aria-label="Justificatifs envoyés">
            {docs.map((d) => (
              <li key={d.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium break-all">{d.original_name}</p>
                    <p className="text-sm text-muted">
                      {DOCUMENT_TYPE_LABELS[d.type]} · {formatBytes(d.size_bytes)} · envoyé le{' '}
                      {formatDate(d.uploaded_at)}
                    </p>
                    <p className="mt-1">
                      {d.verified_at ? (
                        <Badge tone="success">Vérifié le {formatDate(d.verified_at)}</Badge>
                      ) : (
                        <Badge tone="neutral">Non vérifié</Badge>
                      )}
                    </p>
                  </div>
                  {readOnly ? null : (
                    <Button
                      variant="ghost"
                      aria-label={`Supprimer le justificatif ${d.original_name}`}
                      onClick={() => setToDelete(d)}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {readOnly ? null : full ? (
        <p className="text-muted">
          Vous avez atteint la limite de {MAX_DOCUMENTS} justificatifs. Supprimez-en un pour en ajouter
          un autre.
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
          <h3 className="text-lg font-semibold">Ajouter un justificatif</h3>
          <FormError message={formError} />
          <FormSuccess message={message} />
          <Select
            label="Type de document"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            disabled={busy}
          >
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <FileInput
            label="Fichier"
            rules={DOCUMENT_RULES}
            hint={`${DOCUMENT_RULES.typesLabel}, ${formatBytes(DOCUMENT_RULES.maxBytes)} maximum.`}
            error={fileError ?? undefined}
            disabled={busy}
            resetKey={resetKey}
            onChange={(f, err) => {
              setFile(f);
              setFileError(err);
            }}
          />
          <div>
            <Button type="submit" loading={busy}>
              Envoyer le justificatif
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer ce justificatif ?"
        confirmLabel="Supprimer"
        tone="danger"
        onConfirm={async () => {
          if (!toDelete) return;
          await clientApi.deleteDocument(est.type, est.slug, toDelete.id);
          toast.show('Justificatif supprimé.', 'success');
          setMessage('Justificatif supprimé.');
          reload();
        }}
      >
        <p>Le fichier « {toDelete?.original_name} » sera supprimé définitivement.</p>
      </ConfirmDialog>
    </div>
  );
}
