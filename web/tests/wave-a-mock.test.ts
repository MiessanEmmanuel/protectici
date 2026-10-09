import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '@/lib/api/endpoints';

let mockApi: Api;

beforeAll(async () => {
  mockApi = (await import('@/lib/mocks/mock-api')).mockApi;
});

async function loginAs(email: string) {
  const r = await mockApi.login({ email, password: 'motdepasse' });
  if (r.kind === 'two_factor') await mockApi.twoFactorChallenge({ code: '123456' });
}
const logout = () => mockApi.logout();

describe('mock vague A : espace prestataire', () => {
  beforeEach(async () => {
    await logout();
  });

  it('prestataire possède 2 fiches dont une rejetée avec motif et une en attente', async () => {
    await loginAs('prestataire@example.test');
    const list = await mockApi.listMyEstablishments();
    expect(list.data).toHaveLength(2);
    const rejected = list.data.find((e) => e.status === 'rejected');
    expect(rejected?.rejection_reason).toMatch(/.{10,}/);
    expect(list.data.some((e) => e.status === 'pending')).toBe(true);
  });

  it('refuse un champ sensible en PATCH et accepte un champ libre', async () => {
    await loginAs('prestataire@example.test');
    await expect(
      mockApi.updateMyEstablishment('provider', 'garde-lagune-securite', { rccm: 'X' }),
    ).rejects.toMatchObject({ status: 422 });
    const updated = await mockApi.updateMyEstablishment('provider', 'garde-lagune-securite', {
      description: 'Nouvelle description',
    });
    expect(updated.description).toBe('Nouvelle description');
  });

  it('une seule demande de modification en attente (409), annulable', async () => {
    await loginAs('prestataire@example.test');
    const cr = await mockApi.createChangeRequest('provider', 'garde-lagune-securite', { legal_form: 'SA' });
    await expect(
      mockApi.createChangeRequest('provider', 'garde-lagune-securite', { rccm: 'Y' }),
    ).rejects.toMatchObject({ status: 409 });
    await mockApi.cancelChangeRequest('provider', 'garde-lagune-securite', cr.id);
    const again = await mockApi.createChangeRequest('provider', 'garde-lagune-securite', { rccm: 'Y' });
    await mockApi.cancelChangeRequest('provider', 'garde-lagune-securite', again.id);
  });

  it('404 sur la fiche d’autrui', async () => {
    await loginAs('awa@example.test');
    await expect(mockApi.getMyEstablishment('provider', 'garde-lagune-securite')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('Idempotency-Key : deux envois = une fiche', async () => {
    await loginAs('prestataire@example.test');
    const input = {
      type: 'state_force' as const,
      force_type_id: 1,
      name: 'Poste test idempotence',
      city_id: 1,
      consent: true as const,
    };
    const a = await mockApi.createEstablishment(input, 'k1');
    const b = await mockApi.createEstablishment(input, 'k1');
    expect(b.slug).toBe(a.slug);
    const list = await mockApi.listMyEstablishments();
    expect(list.data.filter((e) => e.name === 'Poste test idempotence')).toHaveLength(1);
  });
});

describe('mock vague A : administration', () => {
  beforeEach(async () => {
    await logout();
  });

  it('refuse un non-admin (403)', async () => {
    await loginAs('awa@example.test');
    await expect(mockApi.adminDashboard()).rejects.toMatchObject({ status: 403 });
  });

  it('approbation idempotente, rejet exige 10 caractères, suppression exige le nom', async () => {
    await loginAs('admin@example.test');
    await mockApi.adminEstablishmentAction('provider', 103, 'approve');
    const first = await mockApi.adminGetEstablishment('provider', 103);
    await mockApi.adminEstablishmentAction('provider', 103, 'approve'); // rejeu
    const second = await mockApi.adminGetEstablishment('provider', 103);
    expect(first.status).toBe('approved');
    expect(second.audit).toHaveLength(first.audit.length);
    await expect(mockApi.adminEstablishmentAction('provider', 103, 'reject', 'court')).rejects.toMatchObject({
      status: 422,
    });
    await expect(mockApi.adminDeleteEstablishment('provider', 103, 'faux')).rejects.toMatchObject({ status: 422 });
  });

  it('utilisateurs : pas d’auto-rétrogradation', async () => {
    await loginAs('admin@example.test');
    await expect(mockApi.adminUpdateUser(1, { role: 'user' })).rejects.toMatchObject({ status: 422 });
  });

  it('référentiels : 409 si valeur utilisée', async () => {
    await loginAs('admin@example.test');
    await expect(mockApi.adminDeleteReference('service-types', 1)).rejects.toMatchObject({ status: 409 });
  });
});
