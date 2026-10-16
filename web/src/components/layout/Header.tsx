import Link from 'next/link';
import { HeaderNav } from './HeaderNav';

/** Logo v9 : éléphant sur plaque blanche + mot « PROTECTICI » (texte réel, pas d'image de texte). */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-tap shrink-0 items-center gap-3 text-[1.5rem] font-black tracking-[0.04em] text-inherit no-underline ${className ?? ''}`}
    >
      {/* <img> et non next/image : next/image injecte un style en ligne bloqué par la CSP stricte. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/elephant-icon-192.png"
        alt=""
        width={46}
        height={46}
        fetchPriority="high"
        className="size-[46px] bg-white p-1"
      />
      <span>
        PROTECTICI<span className="sr-only"> — accueil</span>
      </span>
    </Link>
  );
}

/** En-tête bleu fixe (sticky) : logo, navigation à icônes, compte, bouton Menu sous 1280 px. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-c1 text-on-c1">
      <HeaderNav logo={<Logo />} />
    </header>
  );
}
