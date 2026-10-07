import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'sm';

const base =
  'inline-flex min-h-tap items-center justify-center gap-2 rounded-md border border-transparent px-4 font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border-primary bg-surface text-primary hover:bg-primary-soft',
  accent: 'bg-accent text-on-accent hover:brightness-95',
  ghost: 'bg-transparent text-primary hover:bg-primary-soft',
  danger: 'bg-danger text-on-primary hover:brightness-90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'min-h-14 px-6 text-lg',
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
