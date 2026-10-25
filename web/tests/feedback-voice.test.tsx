import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { buildApi } from '@/lib/api/endpoints';
import { createRequester } from '@/lib/api/http';
import { buildCsp } from '@/lib/csp';
import type { AdminFeedback, FeedbackInput, FeedbackVoiceUpload, ReferenceData } from '@/lib/api/types';
import { installMediaMocks, type MediaMocks } from './media-mocks';
import nextConfig from '../next.config';

const createFeedback = vi.fn<(input: FeedbackInput, key: string, voice?: FeedbackVoiceUpload | null) => Promise<unknown>>();
const adminGetFeedback = vi.fn<(id: number) => Promise<AdminFeedback>>();
const adminGetFeedbackVoice = vi.fn<(id: number) => Promise<Blob>>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    createFeedback: (...args: Parameters<typeof createFeedback>) => createFeedback(...args),
    listProviders: vi.fn(),
    adminGetFeedback: (id: number) => adminGetFeedback(id),
    adminGetFeedbackVoice: (id: number) => adminGetFeedbackVoice(id),
    adminListUsers: vi.fn(async () => ({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } })),
  },
}));

import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { FeedbackDetail } from '@/components/admin/feedback/FeedbackDetail';
import { chooseOption } from './select-helpers';

const opt = (id: number, name: string) => ({ id, slug: name.toLowerCase(), name });
const reference = {
  cities: [],
  company_types: [],
  service_types: [opt(1, 'Gardiennage')],
  state_force_types: [],
  procedure_types: [],
  feedback_topics: [opt(10, 'Courtoisie')],
} as ReferenceData;
const RECEIPT = { reference: 'DMT-2026-000124', status: 'new', message: 'Votre message a bien été reçu.' };

type User = ReturnType<typeof userEvent.setup>;
const next = (u: User) => u.click(screen.getByRole('button', { name: 'Suivant' }));

async function toCommentStep(u: User) {
  await u.type(screen.getByLabelText(/^Nom/), 'Koné');
  await u.type(screen.getByLabelText(/^Prénoms/), 'Awa');
  await u.type(screen.getByLabelText(/^Adresse e-mail/), 'awa@example.test');
  await next(u);
  await next(u);
  await u.click(screen.getByRole('radio', { name: 'Une plainte' }));
  await next(u);
  await u.click(screen.getByRole('radio', { name: 'Une prestation' }));
  await chooseOption(u, screen.getByLabelText(/^Type de prestation/), 'Gardiennage');
  await chooseOption(u, screen.getByLabelText(/^Sujet/), 'Courtoisie');
}

let media: MediaMocks;

describe('FeedbackForm : message vocal', () => {
  beforeEach(() => {
    media = installMediaMocks();
    createFeedback.mockReset();
    createFeedback.mockResolvedValue(RECEIPT);
  });
  afterEach(() => {
    cleanup();
    media.restore();
    vi.restoreAllMocks();
  });

  it('choix segmenté : écrit par défaut, vocal sans commentaire requis, envoi avec le vocal', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await toCommentStep(u);

    const text = screen.getByRole('button', { name: 'Écrire un commentaire' });
    const voice = screen.getByRole('button', { name: 'Enregistrer un message vocal' });
    expect(text).toHaveAttribute('aria-pressed', 'true');
    expect(voice).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelectorAll('input[type="radio"][name="comment_mode"]')).toHaveLength(0);

    // Écrit, vide : message commun
    await next(u);
    expect(screen.getAllByText('Écrivez un commentaire ou enregistrez un message vocal.').length).toBeGreaterThan(0);

    await u.click(voice);
    expect(voice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/^Commentaire/)).not.toBeInTheDocument();
    // Vocal sans enregistrement : bloqué
    await next(u);
    expect(screen.getByRole('heading', { name: 'À propos de' })).toBeInTheDocument();
    expect(screen.getAllByText('Écrivez un commentaire ou enregistrez un message vocal.').length).toBeGreaterThan(0);

    await u.click(screen.getByRole('button', { name: 'Commencer l’enregistrement' }));
    const stop = await screen.findByRole('button', { name: 'Arrêter l’enregistrement' });
    now += 42_000;
    await u.click(stop);
    expect(await screen.findByText('Message vocal enregistré (0:42)')).toBeInTheDocument();
    await next(u);

    expect(screen.getByRole('heading', { name: 'Récapitulatif' })).toBeInTheDocument();
    expect(screen.getByText('Message vocal (0:42)')).toBeInTheDocument();
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await u.click(screen.getByRole('button', { name: 'Envoyer mon message' }));
    await screen.findByTestId('reference');
    expect(screen.getByText(/Message vocal \(0:42\) joint à votre dossier/)).toBeInTheDocument();

    const [body, key, sent] = createFeedback.mock.calls[0]!;
    expect(body).not.toHaveProperty('comment');
    expect(body).toMatchObject({ consent: true, target_type: 'service', topic_id: 10, company_website: '' });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent).toMatchObject({ mimeType: 'audio/webm;codecs=opus', durationSeconds: 42 });
    expect(sent!.blob).toBeInstanceOf(Blob);
  });

  it('mode écrit : appel JSON inchangé (aucun vocal transmis)', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await toCommentStep(u);
    await u.type(screen.getByLabelText(/^Commentaire/), 'Le gardien était très aimable.');
    await next(u);
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await u.click(screen.getByRole('button', { name: 'Envoyer mon message' }));
    await screen.findByTestId('reference');
    expect(createFeedback.mock.calls[0]).toHaveLength(2);
    expect(createFeedback.mock.calls[0]![0].comment).toBe('Le gardien était très aimable.');
  });

  it('le formulaire reste en POST', () => {
    render(<FeedbackForm reference={reference} />);
    expect(document.querySelector('form')).toHaveAttribute('method', 'post');
  });
});

describe('client API : envoi multipart du vocal', () => {
  function setup() {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ data: RECEIPT }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    const api = buildApi(createRequester({ baseUrl: 'https://api.test', fetchImpl, readXsrfCookie: () => 'tok' }));
    return { api, calls };
  }
  const input: FeedbackInput = {
    last_name: 'Koné', first_name: 'Awa', email: 'a@b.co', action_type: 'question',
    target_type: 'service', service_type_id: 1, topic_id: 10, consent: true,
    turnstile_token: 'jeton', company_website: '',
  };

  it('avec vocal : FormData avec tous les champs, voice nommé et durée', async () => {
    const { api, calls } = setup();
    const blob = new Blob(['abc'], { type: 'audio/webm;codecs=opus' });
    await api.createFeedback(input, 'key-9', { blob, mimeType: 'audio/webm;codecs=opus', durationSeconds: 42 });
    const { init, url } = calls[0]!;
    expect(url).toBe('https://api.test/api/v1/feedbacks');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined(); // boundary posée par le navigateur
    expect(headers['Idempotency-Key']).toBe('key-9');
    expect(headers['X-XSRF-TOKEN']).toBe('tok');
    const fd = init.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('last_name')).toBe('Koné');
    expect(fd.get('service_type_id')).toBe('1');
    expect(fd.get('topic_id')).toBe('10');
    expect(fd.get('consent')).toBe('1');
    expect(fd.get('turnstile_token')).toBe('jeton');
    expect(fd.get('company_website')).toBe('');
    expect(fd.has('comment')).toBe(false);
    expect(fd.get('voice_duration_seconds')).toBe('42');
    const file = fd.get('voice') as File;
    expect(file.name).toBe('message-vocal.webm');
    expect(file.size).toBe(3);
  });

  it('nom de fichier selon le type (mp4 → m4a, ogg) et durée bornée', async () => {
    const { api, calls } = setup();
    await api.createFeedback(input, 'k1', { blob: new Blob(['a']), mimeType: 'audio/mp4', durationSeconds: 130 });
    await api.createFeedback(input, 'k2', { blob: new Blob(['a']), mimeType: 'audio/ogg;codecs=opus', durationSeconds: 0.2 });
    const a = calls[0]!.init.body as FormData;
    const b = calls[1]!.init.body as FormData;
    expect((a.get('voice') as File).name).toBe('message-vocal.m4a');
    expect(a.get('voice_duration_seconds')).toBe('120');
    expect((b.get('voice') as File).name).toBe('message-vocal.ogg');
    expect(b.get('voice_duration_seconds')).toBe('1');
  });

  it('sans vocal : JSON', async () => {
    const { api, calls } = setup();
    await api.createFeedback({ ...input, comment: 'Une question assez longue.' }, 'k');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[0]!.init.body)).comment).toBe('Une question assez longue.');
  });

  it('adminGetFeedbackVoice : GET /admin/feedbacks/{id}/voice avec cookies, renvoie un Blob', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response('son', { status: 200, headers: { 'Content-Type': 'audio/webm' } });
    }) as unknown as typeof fetch;
    const api = buildApi(createRequester({ baseUrl: 'https://api.test', fetchImpl }));
    const blob = await api.adminGetFeedbackVoice(7);
    expect(calls[0]!.url).toBe('https://api.test/api/v1/admin/feedbacks/7/voice');
    expect(calls[0]!.init.credentials).toBe('include');
    expect(blob.size).toBe(3);
  });
});

const FEEDBACK: AdminFeedback = {
  id: 5,
  reference: 'DMT-2026-000105',
  author: { first_name: 'Awa', last_name: 'Koné', email: 'awa@example.test' },
  provider: null,
  action_type: 'complaint',
  target_type: 'service',
  status: 'new',
  assigned_to: null,
  created_at: '2026-10-20T10:00:00Z',
  voice: { duration_seconds: 42, mime: 'audio/webm', size_bytes: 120_000 },
  civility: null,
  phone: null,
  service_type: null,
  topic: null,
  product_type: null,
  location: null,
  comment: null,
  consent_at: '2026-10-20T10:00:00Z',
  resolved_at: null,
  replies: [],
};

describe('Admin : détail d’un dossier avec message vocal', () => {
  beforeEach(() => {
    media = installMediaMocks();
    adminGetFeedback.mockReset();
    adminGetFeedbackVoice.mockReset();
    adminGetFeedback.mockResolvedValue(FEEDBACK);
  });
  afterEach(() => {
    cleanup();
    media.restore();
  });

  it('« Écouter » récupère le binaire à la demande et affiche le lecteur conçu', async () => {
    const u = userEvent.setup();
    adminGetFeedbackVoice.mockResolvedValue(new Blob(['son'], { type: 'audio/webm' }));
    const { unmount } = render(<FeedbackDetail id={5} onChanged={() => {}} onClose={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Message vocal' })).toBeInTheDocument();
    expect(screen.getByText(/Durée 0:42/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Commentaire' })).not.toBeInTheDocument();
    expect(adminGetFeedbackVoice).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Écouter le message vocal' }));
    expect(adminGetFeedbackVoice).toHaveBeenCalledWith(5);
    const play = await screen.findByRole('button', { name: 'Écouter : Message vocal du dossier' });
    expect(play).toHaveFocus();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '42');
    expect(document.querySelector('audio[controls]')).toBeNull();
    expect(media.createObjectURL).toHaveBeenCalledTimes(1);
    unmount();
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('404 : message français', async () => {
    const u = userEvent.setup();
    adminGetFeedbackVoice.mockRejectedValue(new ApiError(404, 'Not found'));
    render(<FeedbackDetail id={5} onChanged={() => {}} onClose={() => {}} />);
    await u.click(await screen.findByRole('button', { name: 'Écouter le message vocal' }));
    expect(
      await screen.findByText('Ce message vocal est introuvable : il a peut-être été supprimé.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('sans vocal : aucun bloc « Message vocal »', async () => {
    adminGetFeedback.mockResolvedValue({ ...FEEDBACK, voice: null, comment: 'Un commentaire écrit.' });
    render(<FeedbackDetail id={5} onChanged={() => {}} onClose={() => {}} />);
    expect(await screen.findByText('Un commentaire écrit.')).toBeInTheDocument();
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: 'Message vocal' })).not.toBeInTheDocument();
  });
});

describe('En-têtes : micro et lecture blob:', () => {
  it('Permissions-Policy autorise le micro sur le site seulement', async () => {
    const rules = await nextConfig.headers!();
    const policy = rules[0]!.headers.find((h) => h.key === 'Permissions-Policy')!.value;
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('geolocation=(self)');
  });

  it('CSP : media-src self + blob:', () => {
    const csp = buildCsp({ nonce: 'abc', isDev: false, apiOrigin: 'https://api.test' });
    expect(csp).toContain("media-src 'self' blob:");
  });
});
