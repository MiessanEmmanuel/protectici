import type { Metadata } from 'next';
import { AccountView } from '@/components/account/AccountView';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';

export const metadata: Metadata = { title: 'Mon compte', robots: { index: false, follow: false } };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string | string[] }>;
}) {
  const v = (await searchParams).verified;
  return (
    <>
      <PageHeader eyebrow="Espace ProtectIci" title="Mon compte" />
      <Container className="py-section">
        <div className="max-w-[52rem]">
          <AccountView justVerified={(Array.isArray(v) ? v[0] : v) === '1'} />
        </div>
      </Container>
    </>
  );
}
