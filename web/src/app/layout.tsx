import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SessionProvider } from '@/components/layout/SessionProvider';
import { SkipLink } from '@/components/layout/SkipLink';
import { ToastProvider } from '@/components/ui/Toast';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/env';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ProtectIci — Annuaire de la sécurité privée en Côte d’Ivoire',
    template: '%s | ProtectIci',
  },
  description:
    'Trouvez une entreprise de sécurité privée ou une force étatique près de chez vous en Côte d’Ivoire : gardiennage, vidéosurveillance, alarmes, escorte, formation.',
  applicationName: 'ProtectIci',
  robots: ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { siteName: 'ProtectIci', locale: 'fr_CI', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0343a4',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // La CSP à nonce (proxy.ts) impose un rendu dynamique : le nonce est généré à chaque requête.
  await connection();
  return (
    <html lang="fr">
      <body>
        <SessionProvider>
          <ToastProvider>
            <SkipLink />
            <Header />
            <main id="contenu" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
