import type { Metadata } from 'next';
import { NewsletterUnsubscribe } from '@/components/content/NewsletterToken';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Désinscription de la lettre d’information',
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
      <PageHeader title="Désinscription de la lettre d’information" />
      <Container className="py-section">
        <div className="max-w-[42rem] border-2 border-ink p-5 md:p-8">
          <NewsletterUnsubscribe token={token} />
        </div>
      </Container>
    </>
  );
}
