/**
 * Indicateur « session probablement ouverte » (R14). Le cookie de session Sanctum est httpOnly : le JS ne
 * peut pas savoir s'il existe. Sans indicateur, chaque visiteur anonyme appelait /auth/user et recevait un
 * 401 affiché en erreur dans la console. Ce cookie ne contient AUCUN jeton ni donnée personnelle (valeur
 * fixe « 1 ») ; il évite seulement l'appel quand personne ne s'est connecté depuis ce navigateur.
 * L'API reste seule juge : un indicateur périmé provoque un 401, traité comme « anonyme », qui l'efface.
 */
export const SESSION_HINT_COOKIE = 'pi_signed_in';
const SESSION_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === `${SESSION_HINT_COOKIE}=1`);
}

export function writeSessionHint(signedIn: boolean): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = signedIn
    ? `${SESSION_HINT_COOKIE}=1; Max-Age=${SESSION_HINT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
    : `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}
