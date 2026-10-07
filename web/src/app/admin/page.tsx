import type { Metadata } from 'next';
import { AdminGuard } from '@/components/account/AdminGuard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Administration"
        intro="Zone réservée aux administrateurs et aux éditeurs."
      />
      <Container className="max-w-3xl py-8">
        <AdminGuard />
      </Container>
    </>
  );
}
