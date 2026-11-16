import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const miniMap = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/annuaire/sentinelle-securite-abidjan',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ has: () => false, getAll: () => [] }) }));
vi.mock('@/components/map/MiniMap', () => ({
  MiniMap: (props: unknown) => {
    miniMap(props);
    return <div>carte</div>;
  },
}));
vi.mock('@/components/reviews/ReviewForm', () => ({ ReviewForm: () => null }));
vi.mock('@/components/directory/ViewTracker', () => ({ ViewTracker: () => null }));
vi.mock('@/components/directory/FavoriteButton', () => ({ FavoriteButton: () => null }));
vi.mock('@/components/directory/ReviewsList', () => ({ ReviewsList: () => null }));
vi.mock('@/components/claims/ClaimCallout', () => ({ ClaimCallout: () => null }));

let ProviderPage: typeof import('@/app/annuaire/[slug]/page').default;
let serverApi: typeof import('@/lib/api/server').serverApi;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', '1');
  ({ serverApi } = await import('@/lib/api/server'));
  ProviderPage = (await import('@/app/annuaire/[slug]/page')).default;
});

afterEach(() => vi.restoreAllMocks());

const open = async (slug: string) =>
  render(
    await ProviderPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }),
  );

describe('fiche publique : agences', () => {
  it('liste nom, quartier, ville, adresse et téléphone, et passe les agences à la carte', async () => {
    const provider = await serverApi.getProvider('sentinelle-securite-abidjan');
    const branch = provider.branches[0]!;
    await open(provider.slug);
    const section = screen.getByRole('region', { name: 'Agences' });
    const item = within(section).getAllByRole('listitem')[0]!;
    expect(within(item).getByText(branch.label)).toBeInTheDocument();
    expect(within(item).getByText(`${branch.district!.name}, ${branch.city.name}`)).toBeInTheDocument();
    expect(within(item).getByText(branch.address!)).toBeInTheDocument();
    expect(within(item).getByText(branch.geo_description!)).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: new RegExp(`^Appeler ${branch.label}`) })).toHaveAttribute(
      'href',
      `tel:${branch.phone}`,
    );
    expect(within(section).getAllByRole('listitem')).toHaveLength(provider.branches.length);
    expect(miniMap).toHaveBeenLastCalledWith(expect.objectContaining({ branches: provider.branches }));
  });

  it('rend la carte des agences même quand le siège n’a pas de coordonnées', async () => {
    const provider = await serverApi.getProvider('sentinelle-securite-abidjan');
    vi.spyOn(serverApi, 'getProvider').mockResolvedValue({ ...provider, lat: null, lng: null });
    await open(provider.slug);
    expect(miniMap).toHaveBeenLastCalledWith(
      expect.objectContaining({ lat: null, lng: null, branches: provider.branches }),
    );
    expect(screen.getByText('carte')).toBeInTheDocument();
  });

  it('n’affiche pas la section sans agence', async () => {
    const provider = await serverApi.getProvider('sentinelle-securite-abidjan');
    vi.spyOn(serverApi, 'getProvider').mockResolvedValue({ ...provider, branches: [] });
    await open(provider.slug);
    expect(screen.queryByRole('region', { name: 'Agences' })).not.toBeInTheDocument();
  });
});
