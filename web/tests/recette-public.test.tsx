import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

/* Correctifs de recette 2026-11-13, périmètre public (R11, R14, R31, R32, R36, R38, R43). */

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  trackPostView: vi.fn(),
  listFavorites: vi.fn(),
  removeFavorite: vi.fn(),
  listStateForces: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useRouter: () => router,
}));

const server = vi.hoisted(() => ({ getPage: vi.fn() }));
vi.mock('@/lib/api/server', () => ({ serverApi: server }));

vi.mock('@/components/directory/ProviderCard', () => ({
  ProviderCard: ({ provider }: { provider: { name: string } }) => <p>{provider.name}</p>,
}));

vi.mock('@/lib/geolocation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geolocation')>()),
  getBrowserPosition: async () => ({ lat: 5.3, lng: -4 }),
}));

import { AccountGuard } from '@/components/account/AccountGuard';
import { FavoritesSection } from '@/components/account/FavoritesSection';
import { PageView } from '@/components/content/PageView';
import { PostViewTracker } from '@/components/content/PostViewTracker';
import { HomeNearbyForces } from '@/components/home/HomeNearbyForces';
import { SessionProvider, useSession } from '@/components/layout/SessionProvider';
import { ToastProvider } from '@/components/ui/Toast';
import {
  DEFAULT_TILE_URL,
  OSM_TILES,
  buildCsp,
  resolveTileUrl,
  tileOriginsFromEnv,
} from '@/lib/csp';
import { tileAttribution, tileUrl } from '@/lib/env';
import { SESSION_HINT_COOKIE, hasSessionHint, writeSessionHint } from '@/lib/session-hint';

const USER = {
  id: 1,
  first_name: 'Awa',
  last_name: 'Koné',
  email: 'awa@example.test',
  phone: null,
  role: 'user',
  email_verified: true,
  two_factor_enabled: false,
  created_at: '2026-01-01T00:00:00Z',
};

function clearHint() {
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/`;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearHint();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function StatusProbe() {
  const { status } = useSession();
  return <p data-testid="status">{status}</p>;
}

describe('R14 : visiteur anonyme sans appel /auth/user', () => {
  it('sans indicateur de session : anonyme d’emblée, aucun appel', async () => {
    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(api.getUser).not.toHaveBeenCalled();
  });

  it('avec indicateur : interroge l’API ; un 401 (null) efface l’indicateur', async () => {
    writeSessionHint(true);
    api.getUser.mockResolvedValue(null);
    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(api.getUser).toHaveBeenCalledTimes(1);
    expect(hasSessionHint()).toBe(false);
  });

  it('avec indicateur et erreur réseau : anonyme pour l’affichage, indicateur conservé', async () => {
    writeSessionHint(true);
    api.getUser.mockRejectedValue(new ApiError(503, 'Indisponible'));
    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(hasSessionHint()).toBe(true);
  });

  it('avec indicateur et session valide : authentifié, indicateur conservé', async () => {
    writeSessionHint(true);
    api.getUser.mockResolvedValue(USER);
    render(
      <SessionProvider>
        <StatusProbe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(hasSessionHint()).toBe(true);
    expect(document.cookie).toContain(`${SESSION_HINT_COOKIE}=1`);
  });
});

describe('R11 : vue d’article comptée depuis le navigateur', () => {
  it('un seul POST par affichage, échec silencieux', async () => {
    api.trackPostView.mockRejectedValue(new ApiError(429, 'Trop'));
    render(<PostViewTracker slug="alarme-maison" />);
    await waitFor(() => expect(api.trackPostView).toHaveBeenCalledTimes(1));
    expect(api.trackPostView).toHaveBeenCalledWith('alarme-maison');
  });

  it('mock : la lecture ne compte plus, le POST compte', async () => {
    const { mockApi } = await import('@/lib/mocks/mock-api');
    const slug = (await mockApi.listPosts({ per_page: 1 })).data[0]!.slug;
    const before = (await mockApi.getPost(slug)).views_count;
    expect((await mockApi.getPost(slug)).views_count).toBe(before);
    await mockApi.trackPostView(slug);
    expect((await mockApi.getPost(slug)).views_count).toBe(before + 1);
  });
});

describe('R36 : page institutionnelle en erreur', () => {
  it('erreur API autre que 404 : levée (error boundary), pas de page vide en 200', async () => {
    server.getPage.mockRejectedValue(new ApiError(429, 'Trop de requêtes'));
    await expect(PageView({ slug: 'cgu-test-429', fallbackTitle: 'CGU' })).rejects.toThrow(
      /Page indisponible \(429\)/,
    );
  });
});

describe('R31 : retirer un favori', () => {
  const page = (names: string[]) => ({
    data: names.map((n) => ({ slug: n.toLowerCase(), name: n })),
    meta: { current_page: 1, last_page: 1, per_page: 12, total: names.length },
    links: { next: null, prev: null },
  });

  it('bouton « Retirer » nommé, appel DELETE puis rechargement', async () => {
    api.listFavorites
      .mockResolvedValueOnce(page(['Alpha', 'Beta']))
      .mockResolvedValue(page(['Beta']));
    api.removeFavorite.mockResolvedValue(undefined);
    const u = userEvent.setup();
    render(
      <ToastProvider>
        <FavoritesSection />
      </ToastProvider>,
    );
    await u.click(await screen.findByRole('button', { name: 'Retirer Alpha de mes favoris' }));
    expect(api.removeFavorite).toHaveBeenCalledWith('alpha');
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
    expect(await screen.findByText(/« Alpha » a été retiré de vos favoris/)).toBeInTheDocument();
  });
});

describe('R32 : garde des pages /compte/*', () => {
  it('visiteur : redirection vers /connexion avec retour', async () => {
    render(
      <SessionProvider>
        <AccountGuard redirectTo="/compte/mes-devis" intro="Connectez-vous.">
          <p>contenu privé</p>
        </AccountGuard>
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/connexion?redirect=%2Fcompte%2Fmes-devis'),
    );
    expect(screen.queryByText('contenu privé')).toBeNull();
  });

  it('compte connecté et vérifié : contenu affiché', async () => {
    writeSessionHint(true);
    api.getUser.mockResolvedValue(USER);
    render(
      <SessionProvider>
        <AccountGuard redirectTo="/compte/mes-devis" intro="Connectez-vous.">
          <p>contenu privé</p>
        </AccountGuard>
      </SessionProvider>,
    );
    expect(await screen.findByText('contenu privé')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('R43 : « Position utilisée » une seule fois', () => {
  it('le bouton change de libellé, le message seul l’annonce', async () => {
    api.listStateForces.mockResolvedValue({
      data: [
        {
          slug: 'commissariat-1',
          name: 'Commissariat du 1er',
          city: { name: 'Abidjan' },
          distance_m: 800,
        },
      ],
      meta: {},
      links: {},
    });
    const u = userEvent.setup();
    render(<HomeNearbyForces initial={[]} />);
    await u.click(screen.getByRole('button', { name: 'Utiliser ma position' }));
    expect(
      await screen.findByRole('button', { name: 'Actualiser ma position' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Position utilisée/)).toHaveLength(1);
  });
});

describe('R38 : fournisseur de tuiles configurable', () => {
  it('défaut : OSM, attribution OSM', () => {
    expect(resolveTileUrl('')).toBe(DEFAULT_TILE_URL);
    expect(tileOriginsFromEnv('')).toBe(OSM_TILES);
    expect(tileUrl()).toBe(DEFAULT_TILE_URL);
    expect(tileAttribution()).toContain('OpenStreetMap');
  });

  it('modèle https valide : retenu, origine ajoutée à la CSP', () => {
    const url = 'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=publique';
    expect(resolveTileUrl(url)).toBe(url);
    expect(tileOriginsFromEnv(url)).toBe('https://api.maptiler.com');
    expect(tileOriginsFromEnv('https://{s}.tiles.exemple.ci/{z}/{x}/{y}.png')).toBe(
      'https://*.tiles.exemple.ci',
    );
    const csp = buildCsp({
      nonce: 'n',
      isDev: false,
      apiOrigin: 'https://api.exemple.ci',
      tileOrigins: tileOriginsFromEnv(url),
    });
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://api.maptiler.com');
    expect(csp).not.toContain('tile.openstreetmap.org');
  });

  it('valeur invalide (http, sans {z}/{x}/{y}, espaces) : repli sur OSM', () => {
    for (const bad of [
      'http://tiles.exemple.ci/{z}/{x}/{y}.png',
      'https://tiles.exemple.ci/tuile.png',
      'https://tiles.exemple.ci/{z}/{x}/{y}.png https://evil.test',
      'javascript:alert(1)',
    ]) {
      expect(resolveTileUrl(bad)).toBe(DEFAULT_TILE_URL);
      expect(tileOriginsFromEnv(bad)).toBe(OSM_TILES);
    }
  });

  it('attribution supplémentaire : échappée, mention OSM conservée', () => {
    vi.stubEnv('NEXT_PUBLIC_TILE_ATTRIBUTION', '© MapTiler <script>');
    const a = tileAttribution();
    expect(a).toContain('OpenStreetMap');
    expect(a).toContain('© MapTiler &#60;script&#62;');
    expect(a).not.toContain('<script>');
  });
});
