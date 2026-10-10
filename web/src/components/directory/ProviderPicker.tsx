'use client';

import { useId, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { ProviderSummary } from '@/lib/api/types';
import { Button } from '../ui/Button';
import { controlClasses } from '../ui/Field';

export interface PickedProvider {
  slug: string;
  name: string;
}

/**
 * Recherche et sélection de prestataires publiés (une ou plusieurs valeurs, plafonnées par `max`).
 * Les choix sont exposés sous forme de liste avec boutons « Retirer » ; les résultats de recherche
 * sont annoncés (aria-live). Aucune donnée personnelle n'est envoyée : seul le texte de recherche.
 */
export function ProviderPicker({
  selected,
  onChange,
  max = 1,
  label = 'Rechercher un prestataire',
  hint,
}: {
  selected: PickedProvider[];
  onChange: (next: PickedProvider[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProviderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const full = selected.length >= max;

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setError('Saisissez au moins 2 caractères.');
      setResults(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await clientApi.listProviders({ q, per_page: 8, sort: 'name' });
      if (mine === seq.current) setResults(page.data);
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  function add(p: ProviderSummary) {
    if (full || selected.some((s) => s.slug === p.slug)) return;
    onChange([...selected, { slug: p.slug, name: p.name }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            type="search"
            value={query}
            autoComplete="off"
            aria-describedby={hint ? `${id}-hint` : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // n'envoie pas le formulaire parent
                void search();
              }
            }}
            className={controlClasses}
            placeholder="Nom du prestataire"
          />
          <Button variant="secondary" onClick={() => void search()} loading={loading}>
            Rechercher
          </Button>
        </div>
      </div>

      <div aria-live="polite" role="status" className="text-sm text-muted">
        {error ? <span className="text-danger">{error}</span> : null}
        {!error && results && results.length === 0 ? 'Aucun prestataire ne correspond à cette recherche.' : null}
        {!error && results && results.length > 0
          ? `${results.length} résultat${results.length > 1 ? 's' : ''}.`
          : null}
      </div>

      {results && results.length > 0 ? (
        <ul aria-label="Résultats de la recherche" className="flex flex-col gap-2">
          {results.map((p) => {
            const picked = selected.some((s) => s.slug === p.slug);
            return (
              <li
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3"
              >
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted"> · {p.city.name}</span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={picked || full}
                  onClick={() => add(p)}
                  aria-label={`${picked ? 'Déjà choisi' : 'Choisir'} : ${p.name}`}
                >
                  {picked ? 'Choisi' : 'Choisir'}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {full && max > 1 ? (
        <p className="text-sm text-muted">Maximum atteint : {max} prestataires.</p>
      ) : null}

      {selected.length > 0 ? (
        <div>
          <p className="font-semibold">
            {max > 1 ? `Prestataires choisis (${selected.length}/${max})` : 'Prestataire choisi'}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {selected.map((p) => (
              <li
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-primary-soft p-3"
              >
                <span className="font-semibold">{p.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(selected.filter((s) => s.slug !== p.slug))}
                  aria-label={`Retirer ${p.name}`}
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
