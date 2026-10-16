import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Sans JavaScript, un <form> sans attribut method s'envoie en GET et place les champs dans l'URL
 * (mot de passe, code 2FA, données personnelles). Chaque formulaire sensible doit être en POST,
 * avec une action sans paramètre sensible. Les formulaires de recherche restent en GET (voulu).
 */
const SENSITIVE: Record<string, string | null> = {
  'components/auth/LoginForm.tsx': '/connexion',
  'components/auth/RegisterForm.tsx': '/inscription',
  'components/auth/ForgotPasswordForm.tsx': '/mot-de-passe-oublie',
  'components/auth/ResetPasswordForm.tsx': '/reinitialiser-mot-de-passe',
  'components/account/PasswordForm.tsx': '/compte',
  'components/account/TwoFactorSection.tsx': '/compte',
  'components/account/ProfileForm.tsx': '/compte',
  'components/contact/ContactForm.tsx': '/contact',
  'components/quote/QuoteForm.tsx': '/devis',
  'components/feedback/FeedbackForm.tsx': '/dis-moi-tout',
  'components/feedback/FeedbackTracker.tsx': '/dis-moi-tout/suivi',
  'components/establishment/EstablishmentRegistration.tsx': '/inscription-etablissement',
  // Composants présents sur plusieurs pages : POST vers la page courante.
  'components/layout/NewsletterForm.tsx': null,
  'components/reviews/ReviewEditor.tsx': null,
  'components/reviews/ReportReviewButton.tsx': null,
  'components/content/PostComments.tsx': null,
};

const SEARCH = [
  'components/directory/DirectoryFilters.tsx',
  'components/content/BlogHeader.tsx',
  'components/home/HeroSearch.tsx',
];

function formTags(file: string): string[] {
  const src = readFileSync(resolve(__dirname, '../src', file), 'utf8');
  return [...src.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
}

describe('méthode des formulaires (sans JavaScript)', () => {
  for (const [file, action] of Object.entries(SENSITIVE)) {
    it(`${file} : tous les formulaires sont en POST`, () => {
      const tags = formTags(file);
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag).toMatch(/\bmethod="post"/);
        expect(tag).not.toMatch(/method="get"/i);
        if (action) expect(tag).toContain(`action="${action}"`);
        // Jamais de paramètre dans l'action.
        expect(tag).not.toMatch(/action="[^"]*\?/);
      }
    });
  }

  it('les formulaires de recherche restent en GET', () => {
    for (const file of SEARCH) {
      for (const tag of formTags(file)) expect(tag).not.toMatch(/method="post"/);
    }
  });
});
