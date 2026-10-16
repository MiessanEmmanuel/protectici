import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDashboard, User } from '@/lib/api/types';
import { adminThemeCookie, ADMIN_THEME_COOKIE, parseAdminTheme } from '@/lib/admin-theme';

let pathname = '/admin/blog';
let session: { user: User | null; status: 'loading' | 'anonymous' | 'authenticated'; logout: () => Promise<void> };
let cookieValue: string | undefined;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => pathname,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === ADMIN_THEME_COOKIE && cookieValue ? { name, value: cookieValue } : undefined),
  }),
}));
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));

const dashboard: AdminDashboard = {
  pending_comments: 3, confirmed_subscribers: 7, pending_reviews: 12, open_review_reports: 2,
  new_feedbacks: 2, new_quote_requests: 1, new_contact_messages: 0, pending_providers: 3,
  pending_state_forces: 2, pending_change_requests: 1, users_total: 34, providers_approved: 38,
  state_forces_approved: 30,
  recent_audit: [
    { id: 9, event: 'login_succeeded', user: { id: 1, name: 'Awa Admin' }, auditable_type: 'user', auditable_id: 1,
      old_values: null, new_values: null, ip_address: null, created_at: '2026-10-16T10:00:00Z' },
  ],
};
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    adminDashboard: vi.fn(async () => dashboard),
    adminListNotifications: vi.fn(async () => []),
    adminMarkNotificationRead: vi.fn(async () => undefined),
  },
}));

import AdminLayout from '@/app/admin/layout';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminDashboardView } from '@/components/admin/AdminDashboardView';
import { isAdminPath, PublicChrome } from '@/components/layout/PublicChrome';

const user = (role: User['role'], two_factor_enabled = true): User => ({
  id: 1, first_name: 'Awa', last_name: 'Admin', email: 'a@example.test', phone: null, role,
  email_verified: true, two_factor_enabled, created_at: '2026-01-01T00:00:00Z',
});

/** Découpe une liste de sélecteurs aux virgules de premier niveau (hors :is(…), :has(…)). */
function splitTopLevel(group: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of group) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

function clearThemeCookie() {
  document.cookie = `${ADMIN_THEME_COOKIE}=; Path=/admin; Max-Age=0`;
  document.cookie = `${ADMIN_THEME_COOKIE}=; Max-Age=0`;
}

describe('préférence de thème (cookie)', () => {
  it('sombre par défaut, clair seulement sur la valeur « light »', () => {
    expect(parseAdminTheme(undefined)).toBe('dark');
    expect(parseAdminTheme('')).toBe('dark');
    expect(parseAdminTheme('bleu')).toBe('dark');
    expect(parseAdminTheme('dark')).toBe('dark');
    expect(parseAdminTheme('light')).toBe('light');
  });
  it('cookie non sensible : Path=/admin, 1 an, SameSite=Lax, Secure en HTTPS', () => {
    expect(adminThemeCookie('light', false)).toBe('pi_admin_theme=light; Path=/admin; Max-Age=31536000; SameSite=Lax');
    expect(adminThemeCookie('dark', true)).toMatch(/; Secure$/);
  });
  it('le layout /admin lit le cookie côté serveur et transmet le thème à la coquille', async () => {
    cookieValue = 'light';
    const el = (await AdminLayout({ children: <p>x</p> })) as ReactElement<{ initialTheme: string }>;
    expect(isValidElement(el)).toBe(true);
    expect(el.props.initialTheme).toBe('light');
    cookieValue = undefined;
    const def = (await AdminLayout({ children: <p>x</p> })) as ReactElement<{ initialTheme: string }>;
    expect(def.props.initialTheme).toBe('dark');
  });
});

describe('coquille d’administration', () => {
  beforeEach(() => {
    pathname = '/admin/blog';
    session = { user: user('admin'), status: 'authenticated', logout: vi.fn(async () => undefined) };
    clearThemeCookie();
  });
  afterEach(clearThemeCookie);

  it('pose le thème initial dès le rendu et bascule clair/sombre avec persistance', async () => {
    const written: string[] = [];
    const setter = vi.spyOn(document, 'cookie', 'set').mockImplementation((v: string) => {
      written.push(v);
    });
    const { container } = render(<AdminShell initialTheme="dark"><p>Contenu</p></AdminShell>);
    const root = container.querySelector('[data-admin-theme]')!;
    expect(root).toHaveAttribute('data-admin-theme', 'dark');

    const toggle = screen.getByRole('button', { name: 'Passer en mode clair' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(root).toHaveAttribute('data-admin-theme', 'light');
    expect(written.at(-1)).toBe('pi_admin_theme=light; Path=/admin; Max-Age=31536000; SameSite=Lax');
    const back = screen.getByRole('button', { name: 'Passer en mode sombre' });
    expect(back).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(back);
    expect(root).toHaveAttribute('data-admin-theme', 'dark');
    expect(written.at(-1)).toMatch(/^pi_admin_theme=dark; Path=\/admin;/);
    setter.mockRestore();
  });

  it('respecte un thème clair mémorisé', () => {
    const { container } = render(<AdminShell initialTheme="light"><p>Contenu</p></AdminShell>);
    expect(container.querySelector('[data-admin-theme]')).toHaveAttribute('data-admin-theme', 'light');
  });

  it('affiche les pastilles de compteurs (données du tableau de bord) et le lien actif', async () => {
    pathname = '/admin/avis';
    render(<AdminShell><p>Contenu</p></AdminShell>);
    const nav = screen.getByRole('navigation', { name: 'Administration' });
    const avis = within(nav).getByRole('link', { name: /Avis et signalements/ });
    expect(avis).toHaveAttribute('aria-current', 'page');
    expect(await within(avis).findByText('14')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Établissements/ })).toHaveTextContent('5');
    expect(await screen.findByText(/26 à traiter/)).toBeInTheDocument();
    expect(screen.getByText('Double authentification active')).toBeInTheDocument();
  });

  it('un editor ne voit que le contenu, sans compteurs du tableau de bord', () => {
    session = { ...session, user: user('editor', false) };
    render(<AdminShell><p>Contenu</p></AdminShell>);
    const nav = screen.getByRole('navigation', { name: 'Administration' });
    expect(within(nav).queryByRole('link', { name: /Établissements/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Double authentification active')).not.toBeInTheDocument();
  });
});

describe('tableau de bord', () => {
  it('carte d’accueil, priorités et derniers événements à partir des vraies données', async () => {
    session = { user: user('admin'), status: 'authenticated', logout: vi.fn(async () => undefined) };
    render(<AdminDashboardView />);
    expect(await screen.findByText('Bonjour, Awa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('26 éléments attendent votre décision');
    const prio = screen.getByRole('list', { name: 'Priorités' });
    expect(within(prio).getByRole('link', { name: /Avis à modérer/ })).toHaveTextContent('12');
    expect(within(prio).getByRole('link', { name: /Fiches en attente/ })).toHaveTextContent('3 prestataires · 2 forces');
    expect(screen.getByText('Connexion réussie')).toBeInTheDocument();
  });
});

describe('aucun impact sur les pages publiques', () => {
  it('l’habillage public reste affiché hors de /admin et masqué dans /admin', () => {
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/administrations')).toBe(false);
    expect(isAdminPath('/espace-prestataire')).toBe(false);
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/blog')).toBe(true);
    pathname = '/annuaire';
    const { unmount } = render(<PublicChrome><header>En-tête public</header></PublicChrome>);
    expect(screen.getByText('En-tête public')).toBeInTheDocument();
    unmount();
    pathname = '/admin';
    render(<PublicChrome><header>En-tête public</header></PublicChrome>);
    expect(screen.queryByText('En-tête public')).not.toBeInTheDocument();
  });

  it('toutes les règles du thème admin sont scopées (sauf la pastille masquée hors admin)', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/admin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1]!.trim())
      .filter((s) => s && !s.startsWith('@') && !/^(from|to|\d+%)$/.test(s));
    const allowed = /^(\[data-admin-theme|\.admin-|body:has\(\[data-admin-theme|html:has\(\[data-admin-theme|\.ui-badge-dot$)/;
    for (const group of selectors) {
      for (const sel of splitTopLevel(group)) {
        expect(sel, sel).toMatch(allowed);
      }
    }
    expect(css).not.toMatch(/:root/);
  });

  it('les composants partagés gardent leur rendu public (classes repères seulement)', async () => {
    const { Button } = await import('@/components/ui/Button');
    render(<Button>Valider</Button>);
    const b = screen.getByRole('button', { name: 'Valider' });
    expect(b.className).toContain('ui-btn ui-btn-primary');
    expect(b.className).toContain('border-c1 bg-c1 text-on-c1');
    expect(b.closest('[data-admin-theme]')).toBeNull();
  });
});
