import { PageView, pageMetadata } from '@/components/content/PageView';

export const generateMetadata = () => pageMetadata('qui-sommes-nous', 'Qui sommes-nous');

export default function Page() {
  return <PageView slug="qui-sommes-nous" fallbackTitle="Qui sommes-nous" />;
}
