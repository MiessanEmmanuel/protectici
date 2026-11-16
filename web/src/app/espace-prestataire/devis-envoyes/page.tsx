import type { Metadata } from 'next';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProviderSpaceNav } from '@/components/provider-space/ProviderSpaceNav';
import { SentQuotesView } from '@/components/quote/SentQuotesView';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Devis demandés',
  robots: { index: false, follow: false },
};

export default function ProviderSentQuotesPage() {
  return (
    <>
      <PageHeader
        title="Devis demandés"
        intro="Suivez les demandes de devis que vous avez envoyées à d’autres prestataires et leurs réponses."
      />
      <Container className="flex flex-col gap-6 py-8">
        <RequireAuth
          redirectTo="/espace-prestataire/devis-envoyes"
          intro="Connectez-vous pour suivre vos demandes de devis."
        >
          <ProviderSpaceNav />
          <div className="max-w-[52rem]">
            <SentQuotesView />
          </div>
        </RequireAuth>
      </Container>
    </>
  );
}
