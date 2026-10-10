import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProviderSpaceNav } from '@/components/provider-space/ProviderSpaceNav';
import { ReviewsReceived } from '@/components/provider-space/ReviewsReceived';
import { Container } from '@/components/ui/Container';
import { LoadingBlock } from '@/components/ui/Spinner';

export const metadata: Metadata = {
  title: 'Avis reçus',
  robots: { index: false, follow: false },
};

export default function ReceivedReviewsPage() {
  return (
    <>
      <PageHeader
        title="Avis reçus"
        intro="Consultez les avis publiés sur vos fiches et répondez-y une fois."
      />
      <Container className="flex flex-col gap-6 py-8">
        <RequireAuth
          redirectTo="/espace-prestataire/avis"
          intro="Connectez-vous avec une adresse e-mail vérifiée pour consulter les avis de vos fiches."
        >
          <ProviderSpaceNav />
          <Suspense fallback={<LoadingBlock />}>
            <ReviewsReceived />
          </Suspense>
        </RequireAuth>
      </Container>
    </>
  );
}
