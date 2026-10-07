import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/annuaire',
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ has: () => false, getAll: () => [] }) }));

let AnnuairePage: typeof import('@/app/annuaire/(liste)/page').default;
let HomePage: typeof import('@/app/page').default;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  AnnuairePage = (await import('@/app/annuaire/(liste)/page')).default;
  HomePage = (await import('@/app/page')).default;
});

describe('page /annuaire en mode mock', () => {
  it('affiche filtres, résultats paginés et liens vers les fiches', async () => {
    render(await AnnuairePage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Annuaire des prestataires/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Filtrer les prestataires' })).toBeInTheDocument();
    expect(screen.getByText(/12 prestataires/)).toBeInTheDocument();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(12);
    const titleLink = within(cards[0]!).getAllByRole('link')[0]!;
    expect(titleLink).toHaveAttribute('href', expect.stringMatching(/^\/annuaire\//));
  });

  it('applique les filtres de l’URL', async () => {
    render(await AnnuairePage({ searchParams: Promise.resolve({ service: 'brigade-canine' }) }));
    expect(screen.getByText('1 prestataire')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cerbère Brigade Canine' })).toBeInTheDocument();
  });

  it('affiche un état vide explicite', async () => {
    render(await AnnuairePage({ searchParams: Promise.resolve({ q: 'zzzzzz' }) }));
    expect(screen.getByText('Aucun résultat ne correspond à votre recherche')).toBeInTheDocument();
  });
});

describe("page d'accueil en mode mock", () => {
  it('affiche le formulaire de recherche, les populaires et le bandeau d’inscription', async () => {
    render(await HomePage());
    expect(screen.getByRole('search', { name: 'Rechercher un prestataire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prestataires populaires' })).toBeInTheDocument();
    expect(screen.getByText('Bientôt disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inscrire mon établissement' })).toHaveAttribute(
      'href',
      '/inscription-etablissement',
    );
  });
});
