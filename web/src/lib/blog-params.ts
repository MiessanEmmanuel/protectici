import type { PostQuery } from './api/types';
import type { RawSearchParams } from './search-params';

export const BLOG_PER_PAGE = 9;

function first(raw: RawSearchParams, key: string): string | undefined {
  const v = raw[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === '' ? undefined : s;
}

/** Paramètres d'URL du blog -> requête API (bornes strictes, l'URL est la source de vérité). */
export function parseBlogParams(raw: RawSearchParams): { query: PostQuery; q?: string; page: number } {
  const q = first(raw, 'q')?.trim().slice(0, 100) || undefined;
  const n = Number(first(raw, 'page'));
  const page = Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1;
  return { query: { q, page, per_page: BLOG_PER_PAGE, sort: 'recent' }, q, page };
}
