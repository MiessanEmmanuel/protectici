/**
 * Thème de la zone d'administration (clair / sombre, sombre par défaut).
 * Préférence d'affichage NON sensible, mémorisée dans un cookie lu côté serveur par le layout
 * /admin pour poser `data-admin-theme` dès le premier rendu (aucun flash de thème).
 */

export type AdminTheme = 'dark' | 'light';

export const ADMIN_THEME_COOKIE = 'pi_admin_theme';
export const DEFAULT_ADMIN_THEME: AdminTheme = 'dark';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Valeur du cookie → thème ; toute valeur inconnue retombe sur le thème sombre. */
export function parseAdminTheme(value: string | null | undefined): AdminTheme {
  return value === 'light' ? 'light' : DEFAULT_ADMIN_THEME;
}

/** Chaîne `document.cookie` : Path=/admin, 1 an, SameSite=Lax, Secure en HTTPS. */
export function adminThemeCookie(theme: AdminTheme, secure: boolean): string {
  return [
    `${ADMIN_THEME_COOKIE}=${theme}`,
    'Path=/admin',
    `Max-Age=${ONE_YEAR_SECONDS}`,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** Enregistre le choix dans le navigateur (aucun appel réseau). */
export function persistAdminTheme(theme: AdminTheme): void {
  if (typeof document === 'undefined') return;
  document.cookie = adminThemeCookie(theme, window.location.protocol === 'https:');
}
