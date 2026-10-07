'use client';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/ui/EmptyState';

/** Page d'erreur : aucun détail technique affiché (security.md §20). */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-16">
      <ErrorState
        title="Une erreur est survenue"
        action={
          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Réessayer</Button>
            <ButtonLink href="/" variant="secondary">
              Retour à l’accueil
            </ButtonLink>
          </div>
        }
      >
        Nous n’avons pas pu afficher cette page. Réessayez dans quelques instants.
      </ErrorState>
    </Container>
  );
}
