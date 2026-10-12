import { PageView, pageMetadata } from '@/components/content/PageView';

export const generateMetadata = () => pageMetadata('mentions-legales', 'Mentions légales');

export default function Page() {
  return <PageView slug="mentions-legales" fallbackTitle="Mentions légales" />;
}
