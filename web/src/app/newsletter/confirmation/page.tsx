import type { Metadata } from 'next';
import { NewsletterConfirm } from '@/components/content/NewsletterToken';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Confirmation de l’abonnement',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return (
    <>
      <PageHeader title="Confirmation de l’abonnement" />
      <Container className="max-w-2xl py-8">
        <NewsletterConfirm token={token} />
      </Container>
    </>
  );
}
