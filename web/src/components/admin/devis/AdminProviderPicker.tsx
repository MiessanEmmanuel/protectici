'use client';

import { useId, useRef, useState } from 'react';
import { clientApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { AdminEstablishmentRow } from '@/lib/api/types';
import { Button } from '../../ui/Button';
import { controlClasses } from '../../ui/Field';

export interface PickedProviderId {
  id: number;
  name: string;
}

/**
 * Sélecteur de prestataires publiés pour l’acheminement d’un devis. Le sélecteur public
 * (ProviderPicker) n’expose que des slugs ; l’API d’acheminement attend des identifiants de fiches,
 * qu’on obtient ici via la liste d’administration des établissements (statut « validé »).
 */
export function AdminProviderPicker({
  selected,
  onChange,
  excludeIds,
  max = 5,
}: {
  selected: PickedProviderId[];
  onChange: (next: PickedProviderId[]) => void;
  excludeIds: number[];
  max?: number;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminEstablishmentRow[] | null>(null);
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
      const page = await clientApi.adminListEstablishments({
        type: 'provider',
        status: 'approved',
        q,
        per_page: 8,
        sort: 'name',
      });
      if (mine === seq.current) {
        setResults(page.data.filter((r) => r.type === 'provider' && r.status === 'approved'));
      }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  const available = (results ?? []).filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-semibold">
          Rechercher un prestataire à ajouter
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            type="search"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
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
        {!error && results && available.length === 0
          ? 'Aucun prestataire disponible ne correspond à cette recherche.'
          : null}
        {!error && available.length > 0
          ? `${available.length} résultat${available.length > 1 ? 's' : ''}.`
          : null}
      </div>
      {available.length > 0 ? (
        <ul aria-label="Résultats de la recherche" className="flex flex-col gap-2">
          {available.map((p) => {
            const picked = selected.some((s) => s.id === p.id);
            return (
              <li
                key={p.id}
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
                  onClick={() => onChange([...selected, { id: p.id, name: p.name }])}
                  aria-label={`${picked ? 'Déjà choisi' : 'Choisir'} : ${p.name}`}
                >
                  {picked ? 'Choisi' : 'Choisir'}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {full ? <p className="text-sm text-muted">Maximum atteint : {max} prestataires.</p> : null}
      {selected.length > 0 ? (
        <div>
          <p className="font-semibold">
            Prestataires choisis ({selected.length}/{max})
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {selected.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-primary-soft p-3"
              >
                <span className="font-semibold">{p.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(selected.filter((s) => s.id !== p.id))}
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
