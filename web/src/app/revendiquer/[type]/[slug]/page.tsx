import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClaimForm } from '@/components/claims/ClaimForm';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { claimPath, establishmentPublicPath } from '@/lib/api/claims';
import { serverApi } from '@/lib/api/server';
import type { EstablishmentType } from '@/lib/api/types';
import { safe } from '@/lib/safe';

export const metadata: Metadata = {
  title: 'Revendiquer une fiche',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ type: string; slug: string }> };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function ClaimPage({ params }: Props) {
  const { type: rawType, slug } = await params;
  if ((rawType !== 'provider' && rawType !== 'state_force') || !SLUG.test(slug)) notFound();
  const type: EstablishmentType = rawType;

  const [fiche, error] = await safe<{ name: string; is_claimable?: boolean }>(
    type === 'provider' ? serverApi.getProvider(slug) : serverApi.getStateForce(slug),
    () => notFound(),
  );

  return (
    <>
      <PageHeader
        title="Revendiquer une fiche"
        intro="Vous représentez cet établissement ? Envoyez-nous un justificatif : après vérification par notre équipe, vous pourrez compléter et tenir la fiche à jour."
      />
      <Container className="py-section">
        {!fiche ? (
          <ErrorState>{error?.message ?? 'La fiche est momentanément indisponible.'}</ErrorState>
        ) : fiche.is_claimable === false ? (
          <Card className="max-w-[44rem]">
            <h2 className="text-xl heading-block">Cette fiche est déjà gérée par un compte</h2>
            <p className="mt-2">
              La fiche « {fiche.name} » a déjà un responsable. Si vous pensez qu’il s’agit d’une
              erreur, contactez notre équipe.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href={establishmentPublicPath(type, slug)} variant="secondary">
                Retour à la fiche
              </ButtonLink>
              <ButtonLink href="/contact" variant="ghost">
                Nous contacter
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <RequireAuth
            redirectTo={claimPath(type, slug)}
            intro="Connectez-vous (ou créez un compte) avec une adresse e-mail vérifiée pour revendiquer cette fiche."
          >
            <ClaimForm type={type} slug={slug} name={fiche.name} />
          </RequireAuth>
        )}
      </Container>
    </>
  );
}
