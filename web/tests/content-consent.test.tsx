import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ConsentGate, CookieConsent } from '@/components/layout/CookieConsent';
import { CookieSettingsButton } from '@/components/layout/CookieSettingsButton';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  hasConsent,
  parseConsent,
  serializeConsent,
} from '@/lib/consent';

const clear = () => {
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/`;
};
afterEach(clear);

describe('lib/consent', () => {
  it('round-trip, expiration à 6 mois, valeurs invalides', () => {
    const now = Date.now();
    expect(parseConsent(serializeConsent(true, now), now)).toEqual({ analytics: true, decidedAt: now });
    expect(parseConsent(serializeConsent(false, now), now)?.analytics).toBe(false);
    expect(parseConsent(serializeConsent(true, now), now + (CONSENT_MAX_AGE_SECONDS + 5) * 1000)).toBeNull();
    expect(parseConsent('n-importe-quoi', now)).toBeNull();
    expect(parseConsent(encodeURIComponent(JSON.stringify({ v: 1, a: 2, t: now })), now)).toBeNull();
    expect(parseConsent(null)).toBeNull();
  });
});

describe('bandeau cookies', () => {
  it('s’affiche sans choix, avec Refuser et Accepter de même poids, et aucun traceur avant accord', () => {
    render(
      <>
        <CookieConsent />
        <ConsentGate><p>Mesure d’audience</p></ConsentGate>
      </>,
    );
    const refuse = screen.getByRole('button', { name: 'Tout refuser' });
    const accept = screen.getByRole('button', { name: 'Tout accepter' });
    expect(refuse.className).toBe(accept.className);
    expect(screen.queryByText('Mesure d’audience')).not.toBeInTheDocument();
    expect(hasConsent('analytics')).toBe(false);
  });

  it('refuser mémorise le choix dans un cookie propre et ferme le bandeau', async () => {
    render(<CookieConsent />);
    await userEvent.click(screen.getByRole('button', { name: 'Tout refuser' }));
    expect(screen.queryByRole('button', { name: 'Tout refuser' })).not.toBeInTheDocument();
    expect(document.cookie).toContain(`${CONSENT_COOKIE}=`);
    expect(hasConsent('analytics')).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('accepter active la catégorie ; le lien du pied de page rouvre le bandeau', async () => {
    render(
      <>
        <CookieConsent />
        <CookieSettingsButton />
        <ConsentGate><p>Mesure d’audience</p></ConsentGate>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tout accepter' }));
    expect(screen.getByText('Mesure d’audience')).toBeInTheDocument();
    expect(hasConsent('analytics')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Tout refuser' })).not.toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /cookies/i }));
    });
    expect(screen.getByRole('button', { name: 'Tout refuser' })).toBeInTheDocument();
  });

  it('ne s’affiche pas si un choix valide existe déjà', () => {
    document.cookie = `${CONSENT_COOKIE}=${serializeConsent(false)}; Path=/`;
    render(<CookieConsent />);
    expect(screen.queryByRole('button', { name: 'Tout refuser' })).not.toBeInTheDocument();
  });
});
