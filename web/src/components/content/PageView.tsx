import type { Metadata } from 'next';
import { cache } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { Container } from '../ui/Container';
import { serverApi } from '@/lib/api/server';
import { formatDate } from '@/lib/format';
import { safe } from '@/lib/safe';
import { notFound } from 'next/navigation';
import { SanitizedHtml } from './SanitizedHtml';

/** 404 → page introuvable ; toute autre erreur d'API est levée (error boundary) plutôt qu'une page vide en 200. */
const loadPage = cache(async (slug: string) => {
  const [page, error] = await safe(serverApi.getPage(slug), () => notFound());
  if (!page) throw new Error(`Page indisponible (${error.status})`);
  return page;
});

/** Métadonnées d'une page institutionnelle (contenu fourni par l'API, repli sur un titre fixe). */
export async function pageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  const page = await loadPage(slug);
  return {
    title: page.seo_title ?? page.title ?? fallbackTitle,
    ...(page.seo_description ? { description: page.seo_description } : {}),
    alternates: { canonical: `/${slug}` },
  };
}

/** Page éditoriale (qui sommes-nous, mentions légales, etc.) dont le corps HTML est assaini par l'API. */
export async function PageView({ slug }: { slug: string; fallbackTitle: string }) {
  const page = await loadPage(slug);
  return (
    <>
      <PageHeader eyebrow="ProtectIci" title={page.title} />
      <Container className="py-section">
        <div className="max-w-[52rem]">
          <SanitizedHtml html={page.body} />
          <p className="mt-10 border-t-2 border-ink pt-4 text-sm text-ink-2">
            Dernière mise à jour :{' '}
            <time dateTime={page.updated_at}>{formatDate(page.updated_at)}</time>
          </p>
        </div>
      </Container>
    </>
  );
}
