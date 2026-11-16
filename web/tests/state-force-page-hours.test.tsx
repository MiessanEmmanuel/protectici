import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/forces-etatiques',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ has: () => false, getAll: () => [] }) }));
vi.mock('@/components/map/MiniMap', () => ({ MiniMap: () => <div>carte</div> }));

let ForcePage: typeof import('@/app/forces-etatiques/[slug]/page').default;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ForcePage = (await import('@/app/forces-etatiques/[slug]/page')).default;
});

function jsonLd(): Record<string, unknown> {
  const script = document.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent ?? '{}') as Record<string, unknown>;
}

describe('fiche publique d’une force étatique : horaires (R02, R42)', () => {
  it('affiche les horaires structurés regroupés et les expose en JSON-LD', async () => {
    render(
      await ForcePage({ params: Promise.resolve({ slug: 'poste-de-douane-du-port-d-abidjan' }) }),
    );
    const section = screen.getByRole('heading', { name: 'Horaires' }).parentElement!;
    expect(section).toHaveTextContent('Du lundi au vendredi :8 h – 16 h');
    expect(section).toHaveTextContent('Samedi et dimanche :fermé');
    expect(screen.getByText('Horaires limités')).toBeInTheDocument();
    expect(screen.queryByText(/Horaires non communiqués/)).not.toBeInTheDocument();
    expect(jsonLd().openingHours).toEqual(['Mo-Fr 08:00-16:00']);
  });

  it('ouvert 24 h/24 : badge et texte cohérents, sans « Horaires non communiqués »', async () => {
    render(
      await ForcePage({
        params: Promise.resolve({ slug: 'caserne-des-sapeurs-pompiers-de-treichville' }),
      }),
    );
    expect(screen.getByText('Ouvert 24 h/24')).toBeInTheDocument();
    expect(screen.getByText('Ouvert 24 h/24, 7 j/7.')).toBeInTheDocument();
    expect(screen.queryByText(/Horaires non communiqués/)).not.toBeInTheDocument();
    expect(screen.queryByText('Horaires limités')).not.toBeInTheDocument();
    expect(jsonLd().openingHours).toEqual(['Mo-Su']);
  });
});
