import { Navigation } from 'lucide-react';
import { buttonClasses, type ButtonVariant } from '../ui/Button';

/**
 * URL d'itinéraire Google Maps (API « Maps URLs », sans clé) : destination par coordonnées
 * si connues, sinon par adresse textuelle. Le point de départ est la position de l'utilisateur.
 */
export function googleMapsDirectionsUrl({
  lat,
  lng,
  address,
  place,
}: {
  lat: number | null;
  lng: number | null;
  address?: string | null;
  place?: string | null;
}): string | null {
  let destination: string;
  if (lat !== null && lng !== null) {
    destination = `${lat},${lng}`;
  } else {
    const parts = [address, place].filter(Boolean);
    if (parts.length === 0) return null;
    destination = [...parts, "Côte d'Ivoire"].join(', ');
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Bouton « Faire un itinéraire » : ouvre Google Maps dans un nouvel onglet (ou l'appli sur mobile). */
export function DirectionsLink({
  name,
  variant = 'outline',
  className,
  ...location
}: {
  name: string;
  lat: number | null;
  lng: number | null;
  address?: string | null;
  place?: string | null;
  variant?: ButtonVariant;
  className?: string;
}) {
  const href = googleMapsDirectionsUrl(location);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses(variant, 'md', className)}
      aria-label={`Faire un itinéraire vers ${name} dans Google Maps (s’ouvre dans un nouvel onglet)`}
    >
      <Navigation aria-hidden="true" />
      Faire un itinéraire
    </a>
  );
}

/** Ligne de liste « Coordonnées » contenant le bouton ; rien si aucune localisation. */
export function DirectionsItem(props: Parameters<typeof DirectionsLink>[0]) {
  if (!googleMapsDirectionsUrl(props)) return null;
  return (
    <li className="border-t-2 border-current py-3">
      <DirectionsLink {...props} className="w-full" />
    </li>
  );
}
