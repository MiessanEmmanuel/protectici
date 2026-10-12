import type { Metadata } from 'next';
import { cache } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { Container } from '../ui/Container';
import { ErrorState } from '../ui/EmptyState';
import { serverApi } from '@/lib/api/server';
import { formatDate } from '@/lib/format';
import { safe } from '@/lib/safe';
import { notFound } from 'next/navigation';
import { SanitizedHtml } from './SanitizedHtml';

const loadPage = cache((slug: string) => safe(serverApi.getPage(slug), () => notFound()));

/** Métadonnées d'une page institutionnelle (contenu fourni par l'API, repli sur un titre fixe). */
export async function pageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  const [page] = await loadPage(slug);
  return {
    title: page?.seo_title ?? page?.title ?? fallbackTitle,
    ...(page?.seo_description ? { description: page.seo_description } : {}),
    alternates: { canonical: `/${slug}` },
  };
}

/** Page éditoriale (qui sommes-nous, mentions légales, etc.) dont le corps HTML est assaini par l'API. */
export async function PageView({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const [page, error] = await loadPage(slug);
  if (!page) {
    return (
      <Container className="py-10">
        <ErrorState title={`${fallbackTitle} indisponible`}>{error?.message}</ErrorState>
      </Container>
    );
  }
  return (
    <>
      <PageHeader title={page.title} />
      <Container className="py-8">
        <div className="mx-auto max-w-3xl">
          <SanitizedHtml html={page.body} />
          <p className="mt-8 text-sm text-muted">
            Dernière mise à jour : <time dateTime={page.updated_at}>{formatDate(page.updated_at)}</time>
          </p>
        </div>
      </Container>
    </>
  );
}
