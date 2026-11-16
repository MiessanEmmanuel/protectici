'use client';

import Link from 'next/link';
import { CLAIM_STATUS_LABELS, claimsApi, establishmentPublicPath } from '@/lib/api/claims';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-async';
import { ErrorState } from '../ui/EmptyState';
import { LoadingBlock } from '../ui/Spinner';
import { Badge } from '../ui/Tag';
import { Button } from '../ui/Button';

/**
 * « Mes revendications » de l'espace établissement (GET /me/claims). Masquée quand le compte
 * n'a jamais revendiqué de fiche, pour ne pas encombrer l'espace.
 */
export function MyClaimsSection() {
  const state = useResource(() => claimsApi.listMyClaims(), []);

  if (state.data === null) {
    if (state.loading) return <LoadingBlock label="Chargement de vos revendications…" />;
    return (
      <section aria-labelledby="mes-revendications-titre" id="mes-revendications">
        <h2 id="mes-revendications-titre" className="text-xl heading-block">
          Mes revendications
        </h2>
        <ErrorState
          action={
            <Button variant="secondary" onClick={state.reload}>
              Réessayer
            </Button>
          }
        >
          {state.error?.message}
        </ErrorState>
      </section>
    );
  }
  if (state.data.length === 0) return null;

  return (
    <section
      id="mes-revendications"
      aria-labelledby="mes-revendications-titre"
      className="flex scroll-mt-header flex-col gap-3"
    >
      <h2 id="mes-revendications-titre" className="text-xl heading-block">
        Mes revendications
      </h2>
      <ul className="flex flex-col gap-3">
        {state.data.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 border-2 border-ink bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold break-words">
                <Link href={establishmentPublicPath(c.establishment.type, c.establishment.slug)}>
                  {c.establishment.name}
                </Link>
              </p>
              <Badge
                tone={
                  c.status === 'approved'
                    ? 'success'
                    : c.status === 'rejected'
                      ? 'danger'
                      : 'accent'
                }
              >
                {CLAIM_STATUS_LABELS[c.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted">
              Demandée le {formatDateTime(c.created_at)}
              {c.reviewed_at ? ` · traitée le ${formatDateTime(c.reviewed_at)}` : ''}
            </p>
            {c.status === 'pending' ? (
              <p className="text-sm">Notre équipe vérifie votre justificatif.</p>
            ) : null}
            {c.status === 'approved' ? (
              <p className="text-sm">
                Vous gérez désormais cette fiche : elle figure dans « Mes établissements ».
              </p>
            ) : null}
            {c.status === 'rejected' && c.rejection_reason ? (
              <p className="text-sm">
                <span className="font-semibold">Motif du refus :</span> {c.rejection_reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
