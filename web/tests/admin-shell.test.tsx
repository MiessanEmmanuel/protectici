import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/api/types';

let pathname = '/admin/blog';
let session: { user: User | null; status: 'authenticated'; logout: () => Promise<void> };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => pathname,
}));
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));
const api = vi.hoisted(() => ({
  adminDashboard: vi.fn(),
  adminListNotifications: vi.fn(async () => []),
  adminMarkNotificationRead: vi.fn(async () => undefined),
}));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));

import { AdminShell } from '@/components/admin/AdminShell';

const user = (role: User['role']): User => ({
  id: 1, first_name: 'Awa', last_name: 'Admin', email: 'a@example.test', phone: null, role,
  email_verified: true, two_factor_enabled: true, created_at: '2026-01-01T00:00:00Z',
});

beforeEach(() => {
  api.adminDashboard.mockReset();
  api.adminDashboard.mockReturnValue(new Promise(() => {}));
  api.adminListNotifications.mockClear();
});

describe('coquille d’administration', () => {
  it('n’affiche pas la cloche (ni d’appel aux notifications) pour un éditeur (R18)', async () => {
    pathname = '/admin/blog';
    session = { user: user('editor'), status: 'authenticated', logout: vi.fn() };
    render(<AdminShell><p>Page enfant</p></AdminShell>);
    expect(screen.getByText('Page enfant')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
    await Promise.resolve();
    expect(api.adminListNotifications).not.toHaveBeenCalled();
  });

  it('affiche la cloche pour un administrateur', async () => {
    pathname = '/admin';
    session = { user: user('admin'), status: 'authenticated', logout: vi.fn() };
    render(<AdminShell><p>Page enfant</p></AdminShell>);
    await waitFor(() => expect(api.adminListNotifications).toHaveBeenCalled());
  });

  it('Échap ferme le menu mobile et rend le focus au bouton (R21)', async () => {
    const u = userEvent.setup();
    pathname = '/admin/blog';
    session = { user: user('editor'), status: 'authenticated', logout: vi.fn() };
    render(<AdminShell><p>Page enfant</p></AdminShell>);
    await u.click(screen.getByRole('button', { name: 'Menu' }));
    const burger = screen.getByRole('button', { name: 'Fermer le menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'true');
    // Le focus part dans le menu, puis Échap.
    screen.getByRole('link', { name: 'Blog' }).focus();
    await u.keyboard('{Escape}');
    const closed = screen.getByRole('button', { name: 'Menu' });
    expect(closed).toHaveAttribute('aria-expanded', 'false');
    expect(closed).toHaveFocus();
  });
});
