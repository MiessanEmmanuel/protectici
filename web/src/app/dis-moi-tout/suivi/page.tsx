import type { Metadata } from 'next';
import { FeedbackTracker } from '@/components/feedback/FeedbackTracker';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Suivre un dossier « Dis-moi tout »',
  robots: { index: false, follow: false },
};

export default function FeedbackTrackingPage() {
  return (
    <>
      <PageHeader
        title="Suivre un dossier"
        intro="Saisissez la référence reçue par e-mail (DMT-…) et l’adresse e-mail utilisée lors de l’envoi."
      />
      <Container className="py-8">
        <FeedbackTracker />
      </Container>
    </>
  );
}
