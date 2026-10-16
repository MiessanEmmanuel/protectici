'use client';

import { Button, ButtonLink } from '@/components/ui/Button';

/** Page d'erreur : aucun détail technique affiché (security.md §20). */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" aria-labelledby="titre-erreur" className="bg-c3 text-on-c3">
      <div className="wrap py-16 md:py-24">
        <p className="eyebrow">Erreur</p>
        <h1 id="titre-erreur" className="mt-3 text-section heading-block">
          Une erreur est survenue
        </h1>
        <p className="mt-4 max-w-[48ch] text-lg opacity-90">
          Nous n’avons pas pu afficher cette page. Réessayez dans quelques instants.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={reset} variant="accent" size="lg">
            Réessayer
          </Button>
          <ButtonLink href="/" variant="light" size="lg">
            Retour à l’accueil
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
