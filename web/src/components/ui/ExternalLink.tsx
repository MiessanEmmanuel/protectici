import type { AnchorHTMLAttributes, ReactNode } from 'react';

/** N'accepte que http(s) : refuse javascript:, data:, etc. (security.md §14). */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value || value.length > 255) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

interface ExternalLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'target' | 'rel'
> {
  href: string | null | undefined;
  children: ReactNode;
}

/** Lien externe : target=_blank + rel sécurisé. Ne rend rien si l'URL n'est pas sûre. */
export function ExternalLink({ href, children, ...rest }: ExternalLinkProps) {
  if (!isSafeHttpUrl(href)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" {...rest}>
      {children}
      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
    </a>
  );
}
