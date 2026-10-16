import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/',
}));

const session = {
  user: null as null | { role: string },
  status: 'anonymous' as string,
  logout: vi.fn(),
};
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));
vi.mock('@/lib/api/client', () => ({ clientApi: { listStateForces: vi.fn() } }));

import { HeroSearch, heroSearchHref } from '@/components/home/HeroSearch';
import { FLASH_INTERVAL_MS, FlashBanner } from '@/components/layout/FlashBanner';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { mediaOriginsFromEnv } from '@/lib/csp';
import { chooseOption } from './select-helpers';

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  window.matchMedia = globalThis.matchMedia;
}

const items = [
  { slug: 'a', title: 'Première info', published_at: '2026-10-07T09:42:00Z' },
  { slug: 'b', title: 'Deuxième info', published_at: '2026-10-07T10:15:00Z' },
  { slug: 'c', title: 'Troisième info', published_at: '2026-10-07T11:30:00Z' },
];

describe('FlashBanner v9', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fait tourner les dépêches, se met en pause au survol, aria-live seulement en pause', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<FlashBanner items={items} />);
    expect(screen.getByText('09H42')).toBeInTheDocument();
    const live = screen.getByRole('link', { name: 'Première info' }).closest('[aria-live]')!;
    expect(live).toHaveAttribute('aria-live', 'off');
    act(() => vi.advanceTimersByTime(FLASH_INTERVAL_MS));
    expect(screen.getByRole('link', { name: 'Deuxième info' })).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('region', { name: 'Flash info' }));
    act(() => vi.advanceTimersByTime(FLASH_INTERVAL_MS * 3));
    expect(screen.getByRole('link', { name: 'Deuxième info' })).toBeInTheDocument();
  });

  it('précédent / suivant mettent en pause et bouclent', () => {
    mockReducedMotion(false);
    render(<FlashBanner items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dépêche précédente' }));
    expect(screen.getByRole('link', { name: 'Troisième info' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reprendre/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('link', { name: 'Troisième info' }).closest('[aria-live]'),
    ).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Dépêche suivante' }));
    expect(screen.getByRole('link', { name: 'Première info' })).toBeInTheDocument();
  });

  it('aucune rotation automatique si mouvement réduit', () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    render(<FlashBanner items={items} />);
    expect(screen.getByRole('button', { name: /reprendre/i })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(FLASH_INTERVAL_MS * 2));
    expect(screen.getByRole('link', { name: 'Première info' })).toBeInTheDocument();
  });

  it('une seule dépêche : pas de contrôles', () => {
    mockReducedMotion(false);
    render(<FlashBanner items={[items[0]!]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('HeaderNav : menu mobile', () => {
  beforeEach(() => {
    session.user = null;
    session.status = 'anonymous';
  });

  it('bouton Menu accessible (aria-expanded, aria-controls), Échap referme', async () => {
    render(<HeaderNav logo={<span>Logo</span>} />);
    const burger = screen.getByRole('button', { name: 'Menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(burger).toHaveAttribute('aria-controls', 'menu-mobile');
    const panel = document.getElementById('menu-mobile')!;
    expect(panel).not.toBeVisible();
    await userEvent.click(burger);
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(screen.getByRole('link', { name: 'Demande de devis' })).toHaveAttribute(
      'href',
      '/devis',
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('déconnecté : Se connecter ; connecté admin : Administration et Déconnexion', () => {
    const { unmount } = render(<HeaderNav logo={null} />);
    expect(screen.getAllByRole('link', { name: 'Se connecter', hidden: true })[0]).toHaveAttribute(
      'href',
      '/connexion',
    );
    unmount();
    session.user = { role: 'admin' };
    session.status = 'authenticated';
    render(<HeaderNav logo={null} />);
    expect(
      screen.getAllByRole('link', { name: 'Administration', hidden: true })[0],
    ).toHaveAttribute('href', '/admin');
    expect(
      screen.getAllByRole('button', { name: 'Déconnexion', hidden: true }).length,
    ).toBeGreaterThan(0);
  });
});

describe('HeroSearch', () => {
  const services = [
    { name: 'Gardiennage armé', slug: 'gardiennage-arme' },
    { name: 'Vidéosurveillance', slug: 'videosurveillance' },
  ];
  const cities = [{ name: 'Abidjan', slug: 'abidjan' }];

  beforeEach(() => push.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it('construit l’URL : service reconnu, texte libre, proximité', () => {
    expect(heroSearchHref('gardiennage arme', 'abidjan', services)).toBe(
      '/annuaire?service=gardiennage-arme&city=abidjan',
    );
    expect(heroSearchHref('Dauphin', '', services)).toBe('/annuaire?q=Dauphin');
    expect(heroSearchHref('', 'abidjan', services, { lat: 5.36, lng: -4.008 })).toBe(
      '/annuaire?lat=5.36&lng=-4.008&sort=distance',
    );
  });

  it('formulaire GET vers /annuaire (sans JS) et navigation avec JS', async () => {
    render(<HeroSearch services={services} cities={cities} />);
    const form = screen.getByRole('search', { name: 'Rechercher un prestataire' });
    expect(form).toHaveAttribute('action', '/annuaire');
    expect(form).toHaveAttribute('method', 'get');
    await userEvent.type(screen.getByLabelText('Service ou entreprise'), 'Vidéosurveillance');
    await chooseOption(userEvent, screen.getByLabelText('Ville'), 'abidjan');
    await userEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(push).toHaveBeenCalledWith('/annuaire?service=videosurveillance&city=abidjan');
  });

  it('« Autour de moi » : position navigateur vers la recherche par proximité', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 5.35987, longitude: -4.00831 } } as GeolocationPosition),
      },
    });
    render(<HeroSearch services={services} cities={cities} />);
    await userEvent.click(screen.getByRole('button', { name: 'Autour de moi' }));
    expect(push).toHaveBeenCalledWith('/annuaire?lat=5.36&lng=-4.008&sort=distance');
  });

  it('« Autour de moi » refusé : message explicite, pas de navigation', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, ko: PositionErrorCallback) =>
          ko({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
      },
    });
    render(<HeroSearch services={services} cities={cities} />);
    await userEvent.click(screen.getByRole('button', { name: 'Autour de moi' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Position refusée/);
    expect(push).not.toHaveBeenCalled();
  });
});

describe('mediaOriginsFromEnv (CSP img-src)', () => {
  it('normalise les origines et ajoute celle de la photo du hero', () => {
    expect(
      mediaOriginsFromEnv(
        'https://cdn.exemple.ci/x, https://*.r2.dev  javascript:alert(1) http://evil.ci',
        'https://images.unsplash.com/photo-1?w=1800',
      ),
    ).toBe('https://cdn.exemple.ci https://*.r2.dev https://images.unsplash.com');
    expect(mediaOriginsFromEnv('', '/hero.webp')).toBe('');
    expect(mediaOriginsFromEnv(undefined, undefined)).toBe('');
  });
});
