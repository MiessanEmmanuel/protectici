import { PageView, pageMetadata } from '@/components/content/PageView';

export const generateMetadata = () => pageMetadata('confidentialite', 'Politique de confidentialité');

export default function Page() {
  return <PageView slug="confidentialite" fallbackTitle="Politique de confidentialité" />;
}
