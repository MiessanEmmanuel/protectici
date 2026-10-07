/**
 * Anti open-redirect (security.md §12) : n'accepte qu'un chemin interne relatif.
 * Refuse //hôte, /\hôte, schémas (javascript:, https:), caractères de contrôle et backslashes.
 */
export function safeRedirect(target: string | null | undefined, fallback = '/compte'): string {
  if (!target) return fallback;
  if (target.length > 512) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//') || target.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(target)) return fallback;
  try {
    const url = new URL(target, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
