'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  claimPath,
  claimsApi,
  establishmentPublicPath,
  SIMILAR_NAME_MIN,
  type SimilarEstablishment,
} from '@/lib/api/claims';
import type { EstablishmentType } from '@/lib/api/types';

export const SIMILAR_DEBOUNCE_MS = 500;

/**
 * Anti-doublon de l'inscription d'établissement (contrat §10.3, GET /establishments/similar) :
 * dès que le nom (et éventuellement la ville ou le téléphone) est saisi, signale les fiches
 * publiées proches. Purement informatif : n'empêche jamais l'inscription ; une erreur est ignorée.
 */
export function SimilarEstablishmentsWarning({
  type,
  name,
  cityId,
  phone,
  debounceMs = SIMILAR_DEBOUNCE_MS,
}: {
  type: EstablishmentType | '';
  name: string;
  cityId?: string;
  phone?: string;
  debounceMs?: number;
}) {
  const [results, setResults] = useState<{ key: string; items: SimilarEstablishment[] }>({
    key: '',
    items: [],
  });
  const trimmed = name.trim();
  const enabled = type !== '' && trimmed.length >= SIMILAR_NAME_MIN;
  const key = JSON.stringify([type, trimmed.toLowerCase(), cityId ?? '', (phone ?? '').trim()]);

  useEffect(() => {
    if (type === '' || !enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      claimsApi
        .findSimilarEstablishments(
          {
            type,
            name: trimmed,
            city_id: cityId || undefined,
            phone: phone?.trim() || undefined,
          },
          controller.signal,
        )
        .then((items) => {
          if (!controller.signal.aborted) setResults({ key, items });
        })
        .catch(() => {
          /* Avertissement facultatif : aucune erreur affichée. */
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` résume type, nom, ville et téléphone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, debounceMs]);

  const items = enabled && results.key === key ? results.items : [];

  return (
    <div aria-live="polite">
      {items.length > 0 ? (
        <section
          aria-labelledby="similar-title"
          className="flex flex-col gap-2 border-2 border-accent-text bg-warning-soft p-4"
        >
          <h3 id="similar-title" className="font-extrabold">
            Cette fiche existe peut-être déjà
          </h3>
          <p className="text-sm">
            {items.length === 1
              ? 'Une fiche publiée ressemble à celle que vous inscrivez.'
              : `${items.length} fiches publiées ressemblent à celle que vous inscrivez.`}{' '}
            S’il s’agit de votre établissement, revendiquez-la plutôt que d’en créer une seconde.
            Vous pouvez aussi poursuivre l’inscription.
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((e) => (
              <li
                key={`${e.type}-${e.slug}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-current pt-2"
              >
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-muted"> · {e.city.name}</span>
                </span>
                <span className="flex flex-wrap gap-3 text-sm font-bold">
                  {e.is_claimable ? (
                    <Link href={claimPath(e.type, e.slug)} className="underline">
                      Revendiquer<span className="sr-only"> la fiche {e.name}</span>
                    </Link>
                  ) : null}
                  <Link
                    href={establishmentPublicPath(e.type, e.slug)}
                    className="underline"
                    target="_blank"
                    rel="noopener"
                  >
                    Voir la fiche<span className="sr-only"> {e.name} (nouvel onglet)</span>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
