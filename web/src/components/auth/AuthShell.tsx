import type { ReactNode } from 'react';

/**
 * Gabarit des pages de compte (connexion, inscription, mot de passe) v9 : aplat bleu avec le
 * titre à gauche (au-dessus sur mobile), formulaire à filet 2 px à droite.
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
    <div className="grid grid-cols-1 lg:min-h-[36rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="bg-c1 text-on-c1 [&_a]:text-inherit">
        <div className="px-4 py-10 lg:py-16 lg:pr-12 lg:pl-[max(1rem,calc((100vw-75rem)/2))]">
          <p className="eyebrow">Espace ProtectIci</p>
          <h1 className="mt-3 max-w-[14ch] text-section heading-block">{title}</h1>
          {intro ? <p className="mt-4 max-w-[40ch] text-lg opacity-90">{intro}</p> : null}
        </div>
      </div>
      <div className="px-4 py-10 lg:py-16 lg:pr-[max(1rem,calc((100vw-75rem)/2))] lg:pl-12">
        <div className="w-full max-w-lg">
          <div className="border-2 border-ink bg-white p-5 sm:p-8">{children}</div>
          {footer ? <p className="mt-5 text-sm">{footer}</p> : null}
        </div>
      </div>
    </div>
  );
}
