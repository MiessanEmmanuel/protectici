'use client';

import { useId, useRef, type ReactNode } from 'react';
import { checkFile, type FileRules } from '@/lib/files';
import { controlClasses, describedBy, Field } from './Field';
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
 */
export function FileInput({
  label,
  rules,
  hint,
  error,
  required,
  disabled,
  onChange,
  resetKey,
  id,
}: FileInputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  const accept = rules.types.join(',');
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required}>
      <input
        key={resetKey}
        ref={ref}
        id={fieldId}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClasses, 'py-2')}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          if (!file) return onChange(null, null);
          const problem = checkFile(file, rules);
          if (problem && ref.current) ref.current.value = '';
          onChange(problem ? null : file, problem);
        }}
      />
    </Field>
  );
}
