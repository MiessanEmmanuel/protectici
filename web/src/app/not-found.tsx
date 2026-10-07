import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Page introuvable', robots: { index: false } };

export default function NotFound() {
  return (
    <Container className="py-16">
      <EmptyState
        title="Page introuvable"
        action={
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/">Retour à l’accueil</ButtonLink>
            <ButtonLink href="/annuaire" variant="secondary">
              Parcourir l’annuaire
            </ButtonLink>
          </div>
        }
      >
        La page que vous cherchez n’existe pas ou a été déplacée.
      </EmptyState>
    </Container>
  );
}
