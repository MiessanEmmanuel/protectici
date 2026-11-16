import { claimPath } from '@/lib/api/claims';
import type { EstablishmentType } from '@/lib/api/types';
import { ButtonLink } from '../ui/Button';

/**
 * Bloc sobre affiché sur une fiche publique sans propriétaire (`is_claimable`, contrat §10.4) :
 * invite l'établissement à revendiquer sa fiche. N'affiche aucune donnée privée.
 */
export function ClaimCallout({
  type,
  slug,
  claimable,
}: {
  type: EstablishmentType;
  slug: string;
  claimable: boolean | undefined;
}) {
  if (claimable !== true) return null;
  return (
    <section
      aria-labelledby="revendiquer-titre"
      className="flex flex-col gap-3 border-2 border-ink p-5"
    >
      <h2 id="revendiquer-titre" className="text-xl heading-block">
        C’est votre établissement&nbsp;?
      </h2>
      <p>Revendiquez cette fiche pour la compléter et la tenir à jour.</p>
      <ButtonLink href={claimPath(type, slug)} variant="outline" className="self-start">
        Revendiquer cette fiche
      </ButtonLink>
    </section>
  );
}
