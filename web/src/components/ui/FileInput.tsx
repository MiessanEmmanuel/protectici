'use client';

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { checkFile, formatBytes, type FileRules } from '@/lib/files';
import { describedBy, Field } from './Field';
import { cn } from './cn';

interface FileInputProps {
  label: ReactNode;
  rules: FileRules;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Fichier choisi (déjà vérifié côté client, pour l'UX uniquement) ou erreur locale. */
  onChange: (file: File | null, error: string | null) => void;
  /** Change la clé pour vider le champ après un envoi réussi. */
  resetKey?: number | string;
  id?: string;
}

/**
 * Sélecteur de fichier avec contrôle de type et de taille côté client (UX uniquement :
 * le serveur vérifie le type réel par contenu, security.md §16).
 *
 * L'input natif reste dans le document (visuellement masqué mais focalisable et annoncé avec
 * son étiquette) ; la zone dessinée l'ouvre au clic et accepte le glisser-déposer.
 */
export function FileInput(props: FileInputProps) {
  // Remonte le composant à chaque resetKey : vide l'input natif et le nom affiché.
  return <FileInputInner key={props.resetKey} {...props} />;
}

function FileInputInner({ label, rules, hint, error, required, disabled, onChange, id }: FileInputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const accept = rules.types.join(',');

  function handle(file: File | null) {
    if (!file) {
      setPicked(null);
      return onChange(null, null);
    }
    const problem = checkFile(file, rules);
    if (problem && ref.current) ref.current.value = '';
    setPicked(problem ? null : file);
    onChange(problem ? null : file, problem);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handle(file);
  }

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required}>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => {
          if (!disabled) ref.current?.click();
        }}
        className={cn(
          'relative flex min-h-btn w-full items-center gap-3 border-2 border-dashed bg-white px-2 py-1.5 text-ink',
          'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
          error
            ? 'border-[color:var(--color-danger)]'
            : 'border-[color:var(--color-ink)] [[data-admin-theme]_&]:border-[color:var(--color-ink-2)]',
          dragging && 'border-solid bg-c4',
          disabled ? 'cursor-not-allowed bg-c4 text-ink-2' : 'cursor-pointer',
        )}
      >
        <input
          ref={ref}
          id={fieldId}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className="sr-only"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handle(e.currentTarget.files?.[0] ?? null)}
        />
        <span
          aria-hidden="true"
          className="ui-btn ui-btn-secondary inline-flex min-h-tap shrink-0 items-center border-2 border-ink bg-white px-3 text-sm font-bold"
        >
          Choisir un fichier
        </span>
        <span aria-hidden="true" className="min-w-0 flex-1 truncate text-sm">
          {picked ? (
            <>
              <span className="font-semibold">{picked.name}</span>
              <span className="text-muted"> · {formatBytes(picked.size)}</span>
            </>
          ) : (
            <span className="text-muted">
              Aucun fichier choisi
              <span className="hidden sm:inline"> · ou glissez-le ici</span>
            </span>
          )}
        </span>
      </div>
    </Field>
  );
}
