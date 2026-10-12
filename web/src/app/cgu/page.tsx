import { PageView, pageMetadata } from '@/components/content/PageView';

export const generateMetadata = () => pageMetadata('cgu', 'Conditions générales d’utilisation');

export default function Page() {
  return <PageView slug="cgu" fallbackTitle="Conditions générales d’utilisation" />;
}
