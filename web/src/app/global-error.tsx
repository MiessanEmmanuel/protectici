'use client';

import './global-error.css';

/** Dernier filet de sécurité (erreur dans le layout racine) : volontairement autonome. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="ge-body">
        <main className="ge-main">
          <h1>Une erreur est survenue</h1>
          <p>Nous n’avons pas pu afficher le site. Réessayez dans quelques instants.</p>
          <button type="button" onClick={reset}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
