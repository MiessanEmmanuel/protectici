import type { Metadata } from 'next';
import { RequireAuth } from '@/components/establishment/RequireAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { MyReviewsView } from '@/components/reviews/MyReviewsView';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Mes avis',
  robots: { index: false, follow: false },
};

export default function MyReviewsPage() {
  return (
    <>
      <PageHeader
        title="Mes avis"
        intro="Retrouvez les avis que vous avez donnés, leur statut de modération et les réponses des prestataires."
      />
      <Container className="py-section">
        <div className="max-w-[52rem]">
          <RequireAuth
            redirectTo="/compte/mes-avis"
            intro="Connectez-vous pour consulter et gérer vos avis."
          >
            <MyReviewsView />
          </RequireAuth>
        </div>
      </Container>
    </>
  );
}
