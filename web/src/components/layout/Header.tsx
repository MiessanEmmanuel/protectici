import Link from 'next/link';
import { Container } from '../ui/Container';
import { HeaderNav } from './HeaderNav';

export function Header() {
  return (
    <header className="relative border-b border-line bg-surface">
      <Container className="flex items-center justify-between gap-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-tap items-center"
          aria-label="ProtectIci — accueil"
        >
          {/* <img> et non next/image : next/image injecte un style en ligne (color:transparent) bloqué par la CSP stricte. Le logo est déjà un WebP optimisé. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-protectici.webp"
            alt="ProtectIci"
            width={96}
            height={67}
            fetchPriority="high"
            className="h-12 w-auto"
          />
        </Link>
        <HeaderNav />
      </Container>
    </header>
  );
}
