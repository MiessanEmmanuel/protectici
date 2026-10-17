import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../layout/Header';

/**
 * Gabarit plein écran des pages de compte (connexion, inscription, mot de passe) v9, sans en-tête
 * ni pied de page publics : aplat bleu avec le logo et le titre à gauche (au-dessus sur mobile),
 * formulaire à filet 2 px à droite.
 */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col bg-c1 text-on-c1 [&_a]:text-inherit">
        <div className="flex flex-1 flex-col px-4 py-6 lg:py-10 lg:pr-12 lg:pl-[max(1rem,calc((100vw-75rem)/2))]">
          <Logo />
          <div className="py-8 lg:my-auto lg:py-16">
            <p className="eyebrow">Espace ProtectIci</p>
            <h1 className="mt-3 max-w-[14ch] text-section heading-block">{title}</h1>
            {intro ? <p className="mt-4 max-w-[40ch] text-lg opacity-90">{intro}</p> : null}
          </div>
          <Link
            href="/"
            className="inline-flex min-h-tap items-center gap-2 self-start font-bold underline underline-offset-[0.2em] [&_svg]:size-[1.15em]"
          >
            <ArrowLeft aria-hidden="true" />
            Retour au site
          </Link>
        </div>
      </div>
      <div className="flex items-center px-4 py-10 lg:py-16 lg:pr-[max(1rem,calc((100vw-75rem)/2))] lg:pl-12">
        <div className="w-full max-w-lg">
          <div className="border-2 border-ink bg-white p-5 sm:p-8">{children}</div>
          {footer ? <p className="mt-5 text-sm">{footer}</p> : null}
        </div>
      </div>
    </div>
  );
}
