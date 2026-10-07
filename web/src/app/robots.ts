import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    // Staging / local : rien ne doit être indexé (security.md §21).
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/compte',
        '/connexion',
        '/inscription',
        '/reinitialiser-mot-de-passe',
        '/mot-de-passe-oublie',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
