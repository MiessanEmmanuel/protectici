import { ExternalLink } from '../ui/ExternalLink';

/** Partage : liens simples vers les réseaux (aucun script tiers chargé). */
export function ShareLinks({
  url,
  title,
  label = 'Partager cette fiche',
}: {
  url: string;
  title: string;
  label?: string;
}) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const cls =
    'inline-flex min-h-tap items-center border-2 border-current px-3 text-sm font-extrabold text-inherit no-underline hover:bg-c2 hover:text-on-c2 hover:border-c2';
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        <li>
          <ExternalLink className={cls} href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}>
            Facebook
          </ExternalLink>
        </li>
        <li>
          <ExternalLink
            className={cls}
            href={`https://twitter.com/intent/tweet?url=${u}&text=${t}`}
          >
            X
          </ExternalLink>
        </li>
        <li>
          <ExternalLink
            className={cls}
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}
          >
            LinkedIn
          </ExternalLink>
        </li>
        <li>
          <ExternalLink className={cls} href={`https://wa.me/?text=${t}%20${u}`}>
            WhatsApp
          </ExternalLink>
        </li>
        <li>
          <a className={cls} href={`mailto:?subject=${t}&body=${u}`}>
            E-mail
          </a>
        </li>
      </ul>
    </div>
  );
}
