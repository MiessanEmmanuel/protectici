import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/api/types';
import { adminHomeFor, adminNavFor, canAccessAdminPath } from '@/lib/admin-access';

let pathname = '/admin/blog';
const replace = vi.hoisted(() => vi.fn());
let session: { user: User | null; status: 'loading' | 'anonymous' | 'authenticated' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));

import { AdminAccessGate } from '@/components/admin/AdminAccessGate';

const user = (role: User['role'], two_factor_enabled = false): User => ({
  id: 1, first_name: 'A', last_name: 'B', email: 'a@example.test', phone: null, role,
  email_verified: true, two_factor_enabled, created_at: '2026-01-01T00:00:00Z',
});

describe('accès par rôle à l’administration (confort UX)', () => {
  it('un editor n’accède qu’aux écrans de contenu', () => {
    for (const p of ['/admin/blog', '/admin/blog/12', '/admin/commentaires', '/admin/categories', '/admin/pages']) {
      expect(canAccessAdminPath('editor', p)).toBe(true);
    }
    for (const p of ['/admin', '/admin/partenaires', '/admin/parametres', '/admin/newsletter', '/admin/utilisateurs', '/admin/etablissements', '/admin/journal']) {
      expect(canAccessAdminPath('editor', p)).toBe(false);
    }
  });
  it('un admin accède à tout, un user/provider à rien', () => {
    expect(canAccessAdminPath('admin', '/admin/parametres')).toBe(true);
    expect(canAccessAdminPath('user', '/admin/blog')).toBe(false);
    expect(canAccessAdminPath('provider', '/admin')).toBe(false);
    expect(canAccessAdminPath(null, '/admin/blog')).toBe(false);
  });
  it('filtre la navigation et la page d’accueil selon le rôle', () => {
    const editorLabels = adminNavFor('editor').map((i) => i.href);
    expect(editorLabels).toEqual(['/admin/blog', '/admin/commentaires', '/admin/categories', '/admin/pages']);
    expect(adminNavFor('admin').length).toBeGreaterThan(editorLabels.length);
    expect(adminNavFor('user')).toEqual([]);
    expect(adminHomeFor('editor')).toBe('/admin/blog');
    expect(adminHomeFor('admin')).toBe('/admin');
  });
});

describe('garde d’accès : editor', () => {
  beforeEach(() => { pathname = '/admin/blog'; });
  const gate = () => render(<AdminAccessGate><p>Contenu</p></AdminAccessGate>);

  it('autorise l’écran blog avec la 2FA', () => {
    session = { user: user('editor', true), status: 'authenticated' };
    gate();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });
  it('exige la 2FA de l’éditeur, avec un lien vers /compte (R09)', () => {
    session = { user: user('editor', false), status: 'authenticated' };
    gate();
    expect(screen.getByText('Vérification en deux étapes requise')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activer la vérification en deux étapes' })).toHaveAttribute(
      'href',
      '/compte',
    );
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });
  it.each(['/admin', '/admin/parametres', '/admin/partenaires', '/admin/newsletter'])('refuse %s', (p) => {
    pathname = p;
    session = { user: user('editor', true), status: 'authenticated' };
    gate();
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });
  it('un admin sans 2FA reste bloqué, même sur le blog', () => {
    session = { user: user('admin', false), status: 'authenticated' };
    gate();
    expect(screen.getByText('Vérification en deux étapes requise')).toBeInTheDocument();
  });
});

describe('garde d’accès : visiteur anonyme (R20)', () => {
  it('redirige vers la connexion en conservant la page demandée', () => {
    pathname = '/admin/avis';
    replace.mockClear();
    session = { user: null, status: 'anonymous' };
    render(<AdminAccessGate><p>Contenu</p></AdminAccessGate>);
    expect(replace).toHaveBeenCalledWith('/connexion?redirect=%2Fadmin%2Favis');
  });
});
