const fcfa = new Intl.NumberFormat('fr-FR');

export function formatFcfa(amount: number): string {
  return `${fcfa.format(amount).replace(/ | /g, ' ')} FCFA`;
}

export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined) return null;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Numéro E.164 -> affichage lisible (+225 07 09 44 51 11). */
export function formatPhone(phone: string): string {
  if (!phone.startsWith('+225')) return phone;
  const digits = phone.slice(4);
  return `+225 ${digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
}

/** Valeur sûre pour un lien tel: (chiffres et +). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n > 1 ? plural : singular}`;
}
