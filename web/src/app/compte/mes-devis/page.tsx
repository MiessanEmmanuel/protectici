import type { Metadata } from 'next';
import { AccountGuard } from '@/components/account/AccountGuard';
import { PageHeader } from '@/components/layout/PageHeader';
import { SentQuotesView } from '@/components/quote/SentQuotesView';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Mes demandes de devis',
  robots: { index: false, follow: false },
};

export default function MySentQuotesPage() {
  return (
    <>
      <PageHeader
        title="Mes demandes de devis"
        intro="Suivez les demandes de devis envoyées depuis votre compte et les réponses des prestataires."
      />
      <Container className="py-section">
        <div className="max-w-[52rem]">
          <AccountGuard
            redirectTo="/compte/mes-devis"
            intro="Connectez-vous pour suivre vos demandes de devis."
          >
            <SentQuotesView />
          </AccountGuard>
        </div>
      </Container>
    </>
  );
}
