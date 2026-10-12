import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SanitizedHtml } from '@/components/content/SanitizedHtml';
import { FlashBanner } from '@/components/layout/FlashBanner';
import { sanitizeEditorHtml, isSafeLink } from '@/lib/sanitize-html';

const confirm = vi.fn();
const unsub = vi.fn();
vi.mock('@/lib/api/client', () => ({
  clientApi: {
    confirmNewsletter: (t: string) => confirm(t),
    unsubscribeNewsletter: (t: string) => unsub(t),
  },
}));

import { NewsletterConfirm, NewsletterUnsubscribe } from '@/components/content/NewsletterToken';

describe('FlashBanner', () => {
  const items = [
    { slug: 'a', title: 'Première info', published_at: '2026-10-07T09:00:00Z' },
    { slug: 'b', title: 'Seconde info', published_at: '2026-10-07T10:00:00Z' },
  ];
  it('ne rend rien sans article', () => {
    const { container } = render(<FlashBanner items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('liens vers les articles, copie dupliquée masquée, bouton pause accessible', async () => {
    render(<FlashBanner items={items} />);
    expect(screen.getAllByRole('link', { name: 'Première info' })).toHaveLength(1); // la copie est aria-hidden/inert
    const pause = screen.getByRole('button', { name: /pause/i });
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(pause);
    expect(screen.getByRole('button', { name: /reprendre/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('assainissement client et SanitizedHtml', () => {
  it('retire script, handlers, iframe, javascript:', () => {
    const out = sanitizeEditorHtml(
      '<p onclick="x()">Bonjour <a href="javascript:alert(1)">piège</a> <a href="https://exemple.ci">ok</a></p><script>alert(1)</script><iframe src="https://evil"></iframe><img src="x" onerror="y()">',
    );
    expect(out).not.toMatch(/script|onclick|onerror|iframe|javascript:/i);
    expect(out).toContain('https://exemple.ci');
    expect(out).toContain('nofollow');
  });
  it('liens : http(s)/mailto seulement', () => {
    expect(isSafeLink('https://a.ci')).toBe(true);
    expect(isSafeLink('mailto:a@b.ci')).toBe(true);
    expect(isSafeLink('data:text/html,x')).toBe(false);
    expect(isSafeLink(' java\nscript:alert(1)')).toBe(false);
  });
  it('SanitizedHtml rend le HTML fourni', () => {
    render(<SanitizedHtml html="<h2>Titre</h2><p>Texte</p>" />);
    expect(screen.getByRole('heading', { name: 'Titre' })).toBeInTheDocument();
  });
});

describe('jetons de newsletter', () => {
  it('confirmation : appelle l’API avec le jeton et affiche le succès', async () => {
    confirm.mockResolvedValueOnce(undefined);
    render(<NewsletterConfirm token="abc" />);
    await waitFor(() => expect(screen.getByText(/abonnement est confirmé/)).toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith('abc');
  });
  it('confirmation : jeton absent ou refusé = message générique, sans appel si absent', async () => {
    confirm.mockClear();
    const { unmount } = render(<NewsletterConfirm />);
    expect(screen.getByText(/invalide ou a expiré/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    unmount();
    confirm.mockRejectedValueOnce(new Error('x'));
    render(<NewsletterConfirm token="mauvais" />);
    await waitFor(() => expect(screen.getByText(/invalide ou a expiré/)).toBeInTheDocument());
  });
  it('désinscription : action explicite requise avant l’appel', async () => {
    unsub.mockResolvedValueOnce(undefined);
    render(<NewsletterUnsubscribe token="tok" />);
    expect(unsub).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Me désinscrire' }));
    await waitFor(() => expect(screen.getByText(/désinscrit/)).toBeInTheDocument());
    expect(unsub).toHaveBeenCalledWith('tok');
  });
});
