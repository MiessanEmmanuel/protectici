/**
 * Position du navigateur, demandée UNIQUEMENT sur action explicite de l'utilisateur.
 * Arrondie à ~100 m, jamais stockée ni journalisée (security.md : données de localisation).
 */
export interface BrowserPosition {
  lat: number;
  lng: number;
}

export type GeoErrorKind = 'unsupported' | 'denied' | 'unavailable';

export const GEO_ERROR_MESSAGES: Record<GeoErrorKind, string> = {
  unsupported:
    "La géolocalisation n'est pas disponible sur cet appareil. Choisissez plutôt une ville.",
  denied: 'Position refusée. Vous pouvez choisir une ville à la place.',
  unavailable: "Votre position n'a pas pu être déterminée. Choisissez plutôt une ville.",
};

const round = (n: number) => Math.round(n * 1000) / 1000;

export function getBrowserPosition(): Promise<BrowserPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeoError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }),
      (err) => reject(new GeoError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  });
}

export class GeoError extends Error {
  constructor(public readonly kind: GeoErrorKind) {
    super(GEO_ERROR_MESSAGES[kind]);
    this.name = 'GeoError';
  }
}

export function geoErrorMessage(e: unknown): string {
  return e instanceof GeoError ? e.message : GEO_ERROR_MESSAGES.unavailable;
}
