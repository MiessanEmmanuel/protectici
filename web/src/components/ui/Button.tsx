import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

/**
 * Boutons v9 : angles droits, filet 2 px, graisse 800, pas d'ombre.
 *  - solid   : encre sur blanc (inversion au survol) — appel principal sur fond clair ou or.
 *  - light   : blanc sur aplat foncé (bleu, nuit) — s'inverse en contour au survol.
 *  - accent  : or, texte nuit — appel fort sur fond clair ou bleu.
 *  - outline : contour couleur courante, fond transparent — action secondaire sur tout aplat.
 * Alias historiques conservés : primary (bleu), secondary (contour bleu), ghost, danger.
 */
export type ButtonVariant =
  'solid' | 'light' | 'accent' | 'outline' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2.5 border-2 font-extrabold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:size-[1.2em] [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  solid: 'border-ink bg-ink text-white hover:bg-white hover:text-ink',
  light: 'border-white bg-white text-ink hover:bg-transparent hover:text-white',
  accent: 'border-c2 bg-c2 text-on-c2 hover:border-ink hover:bg-ink hover:text-white',
  outline:
    'border-current bg-transparent text-inherit hover:bg-ink hover:text-white hover:border-ink',
  primary: 'border-c1 bg-c1 text-on-c1 hover:border-ink hover:bg-ink',
  secondary: 'border-c1 bg-white text-c1 hover:bg-c1 hover:text-on-c1',
  ghost: 'border-transparent bg-transparent text-c1 hover:border-c1',
  danger: 'border-danger bg-danger text-white hover:border-ink hover:bg-ink',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-tap px-3.5 text-sm',
  md: 'min-h-tap px-5 text-base',
  lg: 'min-h-btn px-[22px] text-base',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
) {
  return cn(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner label="" className="size-4" /> : null}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const external = /^(tel:|mailto:|https?:)/.test(href);
  const classes = buttonClasses(variant, size, className);
  if (external) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
