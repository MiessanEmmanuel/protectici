import type { Metadata } from 'next';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProviderSpaceNav } from '@/components/provider-space/ProviderSpaceNav';
import { QuotesReceived } from '@/components/provider-space/QuotesReceived';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Devis reçus',
  robots: { index: false, follow: false },
};

export default function ReceivedQuotesPage() {
  return (
    <>
      <PageHeader
        title="Devis reçus"
        intro="Consultez les demandes de devis adressées à vos fiches et répondez-y."
      />
      <Container className="flex flex-col gap-6 py-8">
        <RequireAuth
          redirectTo="/espace-prestataire/devis"
          intro="Connectez-vous avec une adresse e-mail vérifiée pour consulter les devis reçus."
        >
          <ProviderSpaceNav />
          <QuotesReceived />
        </RequireAuth>
      </Container>
    </>
  );
}
