import type { Metadata } from 'next';
import { PartnersView, partnersTitle } from '@/components/content/PartnersView';

export const metadata: Metadata = {
  title: partnersTitle('client'),
  alternates: { canonical: '/nos-clients' },
};

export default function Page() {
  return <PartnersView type="client" />;
}
