/**
 * Consentement aux cookies et traceurs (contrat §9.3, security.md).
 * - Choix mémorisé 6 mois dans un cookie propre (`pi_consent`) : aucun jeton, aucune donnée
 *   personnelle, jamais de localStorage.
 * - Aucun traceur non essentiel ne doit être chargé avant un accord explicite : tout futur
 *   traceur passe par `hasConsent('analytics')` ou `<ConsentGate>`.
 */

export const CONSENT_COOKIE = 'pi_consent';
/** 6 mois (180 jours), en secondes. */
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
export const CONSENT_CHANGE_EVENT = 'pi:consent-change';
export const CONSENT_OPEN_EVENT = 'pi:consent-open';

export type ConsentCategory = 'analytics';

export interface ConsentChoice {
  analytics: boolean;
  /** Date du choix (ms depuis epoch). */
  decidedAt: number;
}

export function serializeConsent(analytics: boolean, now = Date.now()): string {
  return encodeURIComponent(JSON.stringify({ v: 1, a: analytics ? 1 : 0, t: now }));
}

/** Lit la valeur brute du cookie ; renvoie null si absent, illisible ou expiré (> 6 mois). */
export function parseConsent(
  raw: string | null | undefined,
  now = Date.now(),
): ConsentChoice | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(raw));
    if (!data || typeof data !== 'object') return null;
    const { v, a, t } = data as Record<string, unknown>;
    if (v !== 1 || (a !== 0 && a !== 1) || typeof t !== 'number' || !Number.isFinite(t))
      return null;
    if (now - t > CONSENT_MAX_AGE_SECONDS * 1000 || t > now + 60_000) return null;
    return { analytics: a === 1, decidedAt: t };
  } catch {
    return null;
  }
}

export function readConsentRaw(): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return hit ? hit.slice(CONSENT_COOKIE.length + 1) : null;
}

export function readConsent(): ConsentChoice | null {
  return parseConsent(readConsentRaw());
}

export function hasConsent(category: ConsentCategory): boolean {
  return readConsent()?.[category] === true;
}

export function writeConsent(analytics: boolean): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(analytics)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/** Demande la réouverture du bandeau (lien « Gérer mes cookies » du pied de page). */
export function openConsentBanner(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
