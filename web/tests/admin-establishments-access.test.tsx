import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/api/types';

const replace = vi.fn();
let session: { user: User | null; status: 'loading' | 'anonymous' | 'authenticated' };
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('@/components/layout/SessionProvider', () => ({ useSession: () => session }));

import { AdminAccessGate } from '@/components/admin/AdminAccessGate';

const user = (over: Partial<User>): User => ({
  id: 1,
  first_name: 'A',
  last_name: 'B',
  email: 'a@example.test',
  phone: null,
  role: 'admin',
  email_verified: true,
  two_factor_enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

function renderGate() {
  return render(
    <AdminAccessGate>
      <p>Contenu admin</p>
    </AdminAccessGate>,
  );
}

describe('garde d’accès /admin', () => {
  beforeEach(() => replace.mockReset());

  it('redirige un anonyme vers la connexion', () => {
    session = { user: null, status: 'anonymous' };
    renderGate();
    expect(replace).toHaveBeenCalledWith('/connexion?redirect=%2Fadmin');
    expect(screen.queryByText('Contenu admin')).not.toBeInTheDocument();
  });

  it.each(['user', 'editor'] as const)('refuse le rôle %s', (role) => {
    session = { user: user({ role }), status: 'authenticated' };
    renderGate();
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu admin')).not.toBeInTheDocument();
  });

  it('demande la 2FA à un admin sans 2FA', () => {
    session = { user: user({ two_factor_enabled: false }), status: 'authenticated' };
    renderGate();
    expect(screen.getByText('Vérification en deux étapes requise')).toBeInTheDocument();
    expect(screen.queryByText('Contenu admin')).not.toBeInTheDocument();
  });

  it('affiche le contenu à un admin avec 2FA', () => {
    session = { user: user({}), status: 'authenticated' };
    renderGate();
    expect(screen.getByText('Contenu admin')).toBeInTheDocument();
  });
});
