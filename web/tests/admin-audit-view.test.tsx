import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminAuditLog } from '@/lib/api/types';
import { auditJson } from '@/components/admin/audit/redact';

const api = vi.hoisted(() => ({ adminListAuditLogs: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ clientApi: api }));

import { AdminAuditView } from '@/components/admin/audit/AdminAuditView';

const log: AdminAuditLog = {
  id: 1,
  event: 'role_changed',
  user: { id: 3, name: 'Admin Test' },
  auditable_type: 'user',
  auditable_id: 12,
  old_values: { role: 'user', api_token: 'abc' },
  new_values: { role: 'editor', nested: { Password: 'x' } },
  ip_address: '203.0.113.5',
  created_at: '2026-10-01T08:30:00Z',
};
const page = (data: AdminAuditLog[]) => ({
  data,
  meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length },
  links: { next: null, prev: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListAuditLogs.mockResolvedValue(page([log]));
});

describe('AdminAuditView', () => {
  it('affiche le libellé de l’événement et masque les clés sensibles', async () => {
    render(<AdminAuditView />);
    expect(await screen.findByText('Rôle modifié')).toBeInTheDocument();
    expect(screen.getByText('role_changed')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('[masqué]');
    expect(text).not.toContain('abc');
    expect(text).toContain('"editor"');
  });

  it('transmet les filtres (dont dates) à l’API', async () => {
    const u = userEvent.setup();
    render(<AdminAuditView />);
    await screen.findByText('Rôle modifié');
    await u.type(screen.getByLabelText('Événement'), 'role_changed');
    await u.type(screen.getByLabelText('Identifiant de l’utilisateur'), '3');
    await u.selectOptions(screen.getByLabelText('Type d’objet'), 'user');
    await u.type(screen.getByLabelText(/^Du/), '2026-10-01');
    await u.type(screen.getByLabelText(/^Au/), '2026-10-09');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() =>
      expect(api.adminListAuditLogs).toHaveBeenLastCalledWith({
        page: 1,
        event: 'role_changed',
        user_id: 3,
        auditable_type: 'user',
        from: '2026-10-01',
        to: '2026-10-09',
      }),
    );
    await u.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    await waitFor(() => expect(api.adminListAuditLogs).toHaveBeenLastCalledWith({ page: 1 }));
  });

  it('refuse des dates invalides ou inversées sans appeler l’API', async () => {
    const u = userEvent.setup();
    render(<AdminAuditView />);
    await screen.findByText('Rôle modifié');
    const calls = api.adminListAuditLogs.mock.calls.length;
    await u.type(screen.getByLabelText(/^Du/), '2026-02-31');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(await screen.findByText('Date invalide (format AAAA-MM-JJ).')).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/^Du/));
    await u.type(screen.getByLabelText(/^Du/), '2026-10-09');
    await u.type(screen.getByLabelText(/^Au/), '2026-10-01');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(await screen.findByText(/postérieure ou égale/)).toBeInTheDocument();
    expect(api.adminListAuditLogs.mock.calls.length).toBe(calls);
  });

  it('affiche l’état vide', async () => {
    api.adminListAuditLogs.mockResolvedValue(page([]));
    render(<AdminAuditView />);
    expect(await screen.findByText('Aucune entrée ne correspond à ces filtres')).toBeInTheDocument();
  });
});

describe('auditJson', () => {
  it('masque récursivement password, token et secret', () => {
    const out = auditJson({ a: { client_secret: 1, ok: 2 }, list: [{ Token: 'x' }] });
    expect(out).not.toContain('"x"');
    expect(out).toContain('"ok": 2');
    expect(out.match(/\[masqué\]/g)).toHaveLength(2);
  });
});
