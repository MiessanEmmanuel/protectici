'use client';

import { useEffect, useId, useRef } from 'react';
import { isSafeLink, sanitizeEditorHtml } from '@/lib/sanitize-html';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

/**
 * Éditeur riche sobre (contenteditable). Seules les mises en forme de la liste blanche du contrat
 * sont proposées (paragraphe, titres 2–4, gras, italique, listes, citation, lien http/https/mailto).
 * Le HTML émis passe par `sanitizeEditorHtml` ; l'API reste l'unique autorité d'assainissement.
 * Aucune insertion de HTML saisi : le contenu initial est injecté une seule fois après filtrage.
 */
const TOOLS: { label: string; cmd: string; arg?: string }[] = [
  { label: 'Gras', cmd: 'bold' },
  { label: 'Italique', cmd: 'italic' },
  { label: 'Titre', cmd: 'formatBlock', arg: 'h2' },
  { label: 'Sous-titre', cmd: 'formatBlock', arg: 'h3' },
  { label: 'Paragraphe', cmd: 'formatBlock', arg: 'p' },
  { label: 'Liste à puces', cmd: 'insertUnorderedList' },
  { label: 'Liste numérotée', cmd: 'insertOrderedList' },
  { label: 'Citation', cmd: 'formatBlock', arg: 'blockquote' },
  { label: 'Lien', cmd: 'link' },
];

/** Index des outils précédés d'un espacement (groupes : style · blocs · listes · citation/lien). */
const SEPARATED = new Set([2, 5, 7]);

export function RichTextEditor({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  error?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const initial = useRef(value);

  // innerHTML (et non textContent) : le contenu est déjà filtré par la liste blanche de
  // sanitizeEditorHtml ; textContent afficherait les balises brutes puis les ré-enregistrerait échappées.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeEditorHtml(initial.current);
  }, []);

  function emit() {
    if (ref.current) onChange(sanitizeEditorHtml(ref.current.innerHTML));
  }
  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  }
  function link() {
    const url = window.prompt('Adresse du lien (http://, https:// ou mailto:)');
    if (url && isSafeLink(url.trim())) exec('createLink', url.trim());
    else if (url) window.alert('Adresse refusée : seuls les liens http, https et mailto sont autorisés.');
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="font-semibold">{label}</span>
      {/* Éditeur dans une carte arrondie : barre d'outils en pilules, zone de saisie dessous. */}
      <div
        className={cn(
          'rounded-lg border bg-white',
          error ? 'border-danger' : 'border-line',
        )}
      >
        <div
          role="toolbar"
          aria-label="Mise en forme"
          aria-controls={id}
          className="flex flex-wrap gap-1.5 rounded-t-lg border-b border-line bg-surface-alt p-2 sm:p-2.5"
        >
          {TOOLS.map((t, i) => (
            <Button
              key={t.label}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(SEPARATED.has(i) && 'sm:ml-2')}
              onClick={() => (t.cmd === 'link' ? link() : exec(t.cmd, t.arg))}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Collage en texte brut : aucun HTML externe n'entre dans l'éditeur.
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          }}
          className="rich-text min-h-64 rounded-b-lg bg-white p-4 text-ink focus-visible:-outline-offset-2 sm:p-5"
        />
      </div>
      {error ? <p id={`${id}-error`} className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
