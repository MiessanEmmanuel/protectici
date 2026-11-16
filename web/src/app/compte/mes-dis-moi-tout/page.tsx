import type { Metadata } from 'next';
import { AccountGuard } from '@/components/account/AccountGuard';
import { MyFeedbacksView } from '@/components/feedback/MyFeedbacksView';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Mes dossiers « Dis-moi tout »',
  robots: { index: false, follow: false },
};

export default function MyFeedbacksPage() {
  return (
    <>
      <PageHeader
        title="Mes dossiers « Dis-moi tout »"
        intro="Retrouvez les messages envoyés depuis votre compte, leur avancement et les réponses de notre équipe."
      />
      <Container className="py-section">
        <div className="max-w-[52rem]">
          <AccountGuard
            redirectTo="/compte/mes-dis-moi-tout"
            intro="Connectez-vous pour suivre vos dossiers « Dis-moi tout »."
          >
            <MyFeedbacksView />
          </AccountGuard>
        </div>
      </Container>
    </>
  );
}
