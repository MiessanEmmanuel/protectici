import type { Metadata } from 'next';
import { PartnersView, partnersTitle } from '@/components/content/PartnersView';

export const metadata: Metadata = {
  title: partnersTitle('partner'),
  alternates: { canonical: '/nos-partenaires' },
};

export default function Page() {
  return <PartnersView type="partner" />;
}
