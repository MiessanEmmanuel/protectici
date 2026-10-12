'use client';

import { openConsentBanner } from '@/lib/consent';

/** Lien « Gérer mes cookies » du pied de page : rouvre le bandeau de consentement. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openConsentBanner} className={className}>
      Gérer mes cookies
    </button>
  );
}
