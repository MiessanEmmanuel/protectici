import type { Metadata } from 'next';
import { EstablishmentRegistration } from '@/components/establishment/EstablishmentRegistration';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { safe } from '@/lib/safe';

export const metadata: Metadata = {
  title: 'Inscrire mon établissement',
  robots: { index: false, follow: false },
};

export default async function EstablishmentRegistrationPage() {
  const [reference] = await safe(serverApi.getReferenceData());
  return (
    <>
      <PageHeader
        title="Inscrire mon établissement"
        intro="Renseignez votre entreprise de sécurité ou votre structure étatique. Chaque fiche est vérifiée par notre équipe avant d’être publiée."
      />
      <Container className="py-8">
        <RequireAuth
          redirectTo="/inscription-etablissement"
          intro="Connectez-vous (ou créez un compte) avec une adresse e-mail vérifiée pour inscrire votre établissement."
        >
          {reference ? (
            <EstablishmentRegistration reference={reference} />
          ) : (
            <ErrorState>Les listes de choix sont indisponibles. Réessayez dans quelques instants.</ErrorState>
          )}
        </RequireAuth>
      </Container>
    </>
  );
}
