import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function allSlugs(kind: 'providers' | 'forces'): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= 40; page++) {
      const res =
        kind === 'providers'
          ? await serverApi.listProviders({ page, per_page: 50, sort: 'name' })
          : await serverApi.listStateForces({ page, per_page: 50, sort: 'name' });
      slugs.push(...res.data.map((i) => i.slug));
      if (page >= res.meta.last_page) break;
    }
  } catch {
    // API indisponible : on publie au moins les pages statiques
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [providers, forces] = await Promise.all([allSlugs('providers'), allSlugs('forces')]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/annuaire`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/forces-etatiques`, changeFrequency: 'weekly', priority: 0.8 },
    ...providers.map((slug) => ({
      url: `${SITE_URL}/annuaire/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...forces.map((slug) => ({
      url: `${SITE_URL}/forces-etatiques/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
