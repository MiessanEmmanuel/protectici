import type { Metadata } from 'next';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { MyEstablishmentsList } from '@/components/establishment/MyEstablishmentsList';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Espace prestataire',
  robots: { index: false, follow: false },
};

export default function ProviderSpacePage() {
  return (
    <>
      <PageHeader
        title="Espace prestataire"
        intro="Suivez l’état de vos fiches, complétez-les et demandez des modifications."
      />
      <Container className="flex flex-col gap-6 py-8">
        <RequireAuth
          redirectTo="/espace-prestataire"
          intro="Connectez-vous avec une adresse e-mail vérifiée pour gérer vos établissements."
        >
          <div>
            <ButtonLink href="/inscription-etablissement" variant="secondary">
              Inscrire un nouvel établissement
            </ButtonLink>
          </div>
          <MyEstablishmentsList />
        </RequireAuth>
      </Container>
    </>
  );
}
