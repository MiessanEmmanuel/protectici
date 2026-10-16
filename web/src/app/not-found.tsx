import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Page introuvable', robots: { index: false } };

export default function NotFound() {
  return (
    <section aria-labelledby="titre-404" className="bg-c1 text-on-c1">
      <div className="wrap grid grid-cols-1 items-center gap-8 py-16 md:grid-cols-[auto_1fr] md:gap-14 md:py-24">
        <p aria-hidden="true" className="text-[7rem] leading-[0.8] font-black md:text-[11rem]">
          404
        </p>
        <div>
          <h1 id="titre-404" className="text-section heading-block">
            Page introuvable
          </h1>
          <p className="mt-4 max-w-[48ch] text-lg">
            La page que vous cherchez n’existe pas ou a été déplacée.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/" variant="accent" size="lg">
              Retour à l’accueil
            </ButtonLink>
            <ButtonLink href="/annuaire" variant="outline" size="lg">
              Parcourir l’annuaire
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
