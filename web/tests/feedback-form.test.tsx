import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { FeedbackInput, ReferenceData } from '@/lib/api/types';

const createFeedback = vi.fn<(input: FeedbackInput, key: string) => Promise<unknown>>();
const listProviders = vi.fn();
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    createFeedback: (input: FeedbackInput, key: string) => createFeedback(input, key),
    listProviders: (...args: unknown[]) => listProviders(...args),
  },
}));

import { FeedbackForm } from '@/components/feedback/FeedbackForm';

const opt = (id: number, name: string) => ({ id, slug: name.toLowerCase(), name });
const reference = {
  cities: [],
  company_types: [],
  service_types: [opt(1, 'Gardiennage'), opt(2, 'Vidéosurveillance')],
  state_force_types: [],
  procedure_types: [],
  feedback_topics: [opt(10, 'Courtoisie'), opt(11, 'Ponctualité')],
} as ReferenceData;

const RECEIPT = { reference: 'DMT-2026-000123', status: 'new', message: 'Votre message a bien été reçu.' };
const COMMENT = 'Le gardien était très aimable et ponctuel.';

type User = ReturnType<typeof userEvent.setup>;

const next = (u: User) => u.click(screen.getByRole('button', { name: 'Suivant' }));

async function step1(u: User) {
  await u.type(screen.getByLabelText(/^Nom/), 'Koné');
  await u.type(screen.getByLabelText(/^Prénoms/), 'Awa');
  await u.type(screen.getByLabelText(/^Adresse e-mail/), 'awa@example.test');
  await next(u);
}
async function step3(u: User, action = 'Une plainte') {
  await u.click(screen.getByRole('radio', { name: action }));
  await next(u);
}
async function step4Service(u: User) {
  await u.click(screen.getByRole('radio', { name: 'Une prestation' }));
  await u.selectOptions(screen.getByLabelText(/^Type de prestation/), 'Gardiennage');
  await u.selectOptions(screen.getByLabelText(/^Sujet/), 'Courtoisie');
  await u.type(screen.getByLabelText(/^Commentaire/), COMMENT);
  await next(u);
}
/** Va jusqu'au récapitulatif. */
async function toReview(u: User) {
  await step1(u);
  await next(u); // prestataire facultatif
  await step3(u);
  await step4Service(u);
}
const send = (u: User) => u.click(screen.getByRole('button', { name: 'Envoyer mon message' }));

describe('FeedbackForm', () => {
  beforeEach(() => {
    createFeedback.mockReset();
    createFeedback.mockResolvedValue(RECEIPT);
    listProviders.mockReset();
    push.mockClear();
    replace.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('valide chaque étape et déplace le focus sur le titre à chaque changement', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    expect(screen.getByRole('heading', { name: 'Vos informations' })).toBeInTheDocument();
    await next(u);
    expect(screen.getAllByText('Le nom est requis.').length).toBeGreaterThan(0);
    expect(screen.getAllByText("L'adresse e-mail est requise.").length).toBeGreaterThan(0);
    await step1(u);
    const h = await screen.findByRole('heading', { name: 'Prestataire concerné' });
    await waitFor(() => expect(h).toHaveFocus());
    await next(u);
    await next(u); // étape 3 sans choix
    expect(screen.getByRole('heading', { name: 'Que désirez-vous faire ?' })).toBeInTheDocument();
    expect(screen.getAllByText('Choisissez ce que vous désirez faire.').length).toBeGreaterThan(0);
  });

  it('conserve les valeurs en revenant en arrière', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await step1(u);
    await u.click(screen.getByRole('button', { name: 'Précédent' }));
    const h = screen.getByRole('heading', { name: 'Vos informations' });
    await waitFor(() => expect(h).toHaveFocus());
    expect(screen.getByLabelText(/^Nom/)).toHaveValue('Koné');
    expect(screen.getByLabelText(/^Adresse e-mail/)).toHaveValue('awa@example.test');
  });

  it('applique les règles conditionnelles : prestation, sujet, produit', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await step1(u);
    await next(u);
    await step3(u);
    // Rien de choisi : erreurs sur l’objet et le commentaire
    await next(u);
    expect(screen.getAllByText('Précisez l’objet de votre message.').length).toBeGreaterThan(0);
    // Prestation : type et sujet requis
    await u.click(screen.getByRole('radio', { name: 'Une prestation' }));
    await u.type(screen.getByLabelText(/^Commentaire/), COMMENT);
    await next(u);
    expect(screen.getAllByText('Choisissez le type de prestation.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Choisissez le sujet concerné.').length).toBeGreaterThan(0);
    // Produit : pas de sujet, champ produit visible, pas de type de prestation
    await u.click(screen.getByRole('radio', { name: 'Un produit' }));
    expect(screen.queryByLabelText(/^Sujet/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Type de prestation/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Produit concerné/)).toBeInTheDocument();
    await next(u);
    expect(screen.getByRole('heading', { name: 'Récapitulatif' })).toBeInTheDocument();
  });

  it('compte les caractères du commentaire et refuse un commentaire trop court', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await step1(u);
    await next(u);
    await step3(u);
    await u.click(screen.getByRole('radio', { name: 'Un produit' }));
    await u.type(screen.getByLabelText(/^Commentaire/), 'court');
    expect(screen.getByText('5 / 3000')).toBeInTheDocument();
    await next(u);
    expect(screen.getAllByText(/au moins 10 caractères/).length).toBeGreaterThan(0);
  });

  it('bloque explicitement quand la liste des sujets est absente', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={{ ...reference, feedback_topics: undefined }} />);
    await step1(u);
    await next(u);
    await step3(u);
    await u.click(screen.getByRole('radio', { name: 'Un employé' }));
    expect(screen.getByText(/liste des sujets est momentanément indisponible/)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^Commentaire/), COMMENT);
    await next(u);
    expect(screen.getByRole('heading', { name: 'À propos de' })).toBeInTheDocument();
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it('exige le consentement, puis envoie le bon corps et affiche la référence copiable', async () => {
    const u = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    const review = screen.getByRole('heading', { name: 'Récapitulatif' });
    expect(review).toBeInTheDocument();
    expect(screen.getByText(COMMENT)).toBeInTheDocument();
    await send(u);
    expect(screen.getAllByText(/Vous devez accepter le traitement/).length).toBeGreaterThan(0);
    expect(createFeedback).not.toHaveBeenCalled();

    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await send(u);
    expect(await screen.findByTestId('reference')).toHaveTextContent('DMT-2026-000123');
    expect(createFeedback).toHaveBeenCalledTimes(1);
    const [body, key] = createFeedback.mock.calls[0]!;
    expect(body).toEqual({
      last_name: 'Koné',
      first_name: 'Awa',
      email: 'awa@example.test',
      action_type: 'complaint',
      target_type: 'service',
      service_type_id: 1,
      topic_id: 10,
      comment: COMMENT,
      consent: true,
      company_website: '',
    });
    expect(body).not.toHaveProperty('product_type');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByText(/Conservez ce numéro, il vous permettra de suivre votre dossier/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suivre mon dossier' })).toHaveAttribute('href', '/dis-moi-tout/suivi');
    expect(document.body.textContent).not.toContain('awa@example.test');

    await u.click(screen.getByRole('button', { name: 'Copier la référence' }));
    await waitFor(() => expect(screen.getByText('Référence copiée.')).toBeInTheDocument());
    // Pas d’appel de navigation avec des données personnelles
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();

    // Nouveau message : tout est réinitialisé
    await u.click(screen.getByRole('button', { name: 'Envoyer un autre message' }));
    expect(screen.getByLabelText(/^Nom/)).toHaveValue('');
  });

  it('réutilise la même clé d’idempotence après un échec, et bloque le double envoi', async () => {
    const u = userEvent.setup();
    let release: (v: unknown) => void = () => {};
    createFeedback.mockRejectedValueOnce(new ApiError(500, 'Erreur'));
    createFeedback.mockImplementationOnce(() => new Promise((r) => (release = r)));
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await send(u);
    expect(await screen.findByText('Erreur')).toBeInTheDocument();
    await send(u);
    expect(screen.getByRole('button', { name: 'Envoyer mon message' })).toBeDisabled();
    await act(async () => release(RECEIPT));
    expect(await screen.findByTestId('reference')).toBeInTheDocument();
    expect(createFeedback).toHaveBeenCalledTimes(2);
    expect(createFeedback.mock.calls[0]![1]).toBe(createFeedback.mock.calls[1]![1]);
  });

  it('une erreur 422 ramène à l’étape du champ fautif', async () => {
    const u = userEvent.setup();
    createFeedback.mockRejectedValueOnce(new ApiError(422, 'Invalide', { email: ['Cette adresse est refusée.'] }));
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await send(u);
    const h = await screen.findByRole('heading', { name: 'Vos informations' });
    expect(h).toBeInTheDocument();
    expect(screen.getAllByText('Cette adresse est refusée.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Nom/)).toHaveValue('Koné');
  });

  it('affiche le délai en cas de 429', async () => {
    const u = userEvent.setup();
    createFeedback.mockRejectedValueOnce(new ApiError(429, 'Trop', {}, 120));
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await send(u);
    expect(await screen.findByText(/Réessayez dans 2 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer mon message' })).toBeEnabled();
  });

  it('transmet le champ piège rempli tel quel', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await u.type(screen.getByLabelText('Ne pas remplir ce champ'), 'http://spam.test');
    await send(u);
    await screen.findByTestId('reference');
    expect(createFeedback.mock.calls[0]![0].company_website).toBe('http://spam.test');
  });

  it('Turnstile désactivé : aucun widget, aucun script', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} />);
    await toReview(u);
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument();
    expect(document.getElementById('cf-turnstile-script')).toBeNull();
  });

  it('Turnstile activé : jeton exigé avant l’envoi puis transmis', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key-test');
    let callback: (t: string) => void = () => {};
    (window as unknown as { turnstile: unknown }).turnstile = {
      render: (_el: HTMLElement, o: { callback: (t: string) => void }) => {
        callback = o.callback;
        return 'w1';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    try {
      const u = userEvent.setup();
      render(<FeedbackForm reference={reference} />);
      await toReview(u);
      expect(screen.getByTestId('turnstile')).toBeInTheDocument();
      await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
      await send(u);
      expect(await screen.findByText(/vérification anti-robot avant d’envoyer/)).toBeInTheDocument();
      expect(createFeedback).not.toHaveBeenCalled();
      await act(async () => callback('jeton-ok'));
      await send(u);
      await screen.findByTestId('reference');
      expect(createFeedback.mock.calls[0]![0].turnstile_token).toBe('jeton-ok');
    } finally {
      delete (window as unknown as { turnstile?: unknown }).turnstile;
    }
  });

  it('préremplit le prestataire passé par la page et le retire sur demande', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} initialProvider={{ slug: 'dauphin', name: 'Dauphin Sécurité' }} />);
    await step1(u);
    const picked = screen.getByText('Prestataire choisi').parentElement!;
    expect(within(picked).getByText('Dauphin Sécurité')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Retirer Dauphin Sécurité' }));
    expect(screen.queryByText('Prestataire choisi')).not.toBeInTheDocument();
  });

  it('envoie provider_slug quand un prestataire est préchoisi', async () => {
    const u = userEvent.setup();
    render(<FeedbackForm reference={reference} initialProvider={{ slug: 'dauphin', name: 'Dauphin Sécurité' }} />);
    await step1(u);
    await next(u);
    await step3(u, 'Un encouragement'.replace('Un ', 'Un '));
    await step4Service(u);
    expect(screen.getByText('Dauphin Sécurité')).toBeInTheDocument();
    await u.click(screen.getByLabelText(/J’accepte que ProtectIci/));
    await send(u);
    await screen.findByTestId('reference');
    expect(createFeedback.mock.calls[0]![0].provider_slug).toBe('dauphin');
    expect(createFeedback.mock.calls[0]![0].action_type).toBe('encouragement');
  });
});
