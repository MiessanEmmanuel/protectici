import { Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { ExternalLink } from '../ui/ExternalLink';

/** Logos de marque (absents de Lucide), tracés pleins sur une grille 24 × 24. */
function BrandIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5">
      {children}
    </svg>
  );
}

const FacebookIcon = () => (
  <BrandIcon>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </BrandIcon>
);

const XIcon = () => (
  <BrandIcon>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </BrandIcon>
);

const LinkedInIcon = () => (
  <BrandIcon>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </BrandIcon>
);

const WhatsAppIcon = () => (
  <BrandIcon>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </BrandIcon>
);

/** Partage : liens simples vers les réseaux (aucun script tiers chargé). */
export function ShareLinks({
  url,
  title,
  label = 'Partager cette fiche',
  icons = false,
}: {
  url: string;
  title: string;
  label?: string;
  /** Boutons carrés à icône (le nom du réseau reste lu par les lecteurs d'écran). */
  icons?: boolean;
}) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const cls = `inline-flex min-h-tap items-center justify-center border-2 border-current text-sm font-extrabold text-inherit no-underline hover:bg-c2 hover:text-on-c2 hover:border-c2 ${
    icons ? 'min-w-tap' : 'px-3'
  }`;
  const networks: { name: string; href: string; icon: ReactNode; external: boolean }[] = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      icon: <FacebookIcon />,
      external: true,
    },
    {
      name: 'X',
      href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      icon: <XIcon />,
      external: true,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      icon: <LinkedInIcon />,
      external: true,
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${t}%20${u}`,
      icon: <WhatsAppIcon />,
      external: true,
    },
    {
      name: 'E-mail',
      href: `mailto:?subject=${t}&body=${u}`,
      icon: <Mail aria-hidden="true" className="size-5" />,
      external: false,
    },
  ];
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {networks.map((n) => {
          const content = icons ? (
            <>
              {n.icon}
              <span className="sr-only">
                {n.external ? `Partager sur ${n.name}` : 'Partager par e-mail'}
              </span>
            </>
          ) : (
            n.name
          );
          return (
            <li key={n.name}>
              {n.external ? (
                <ExternalLink className={cls} href={n.href} title={icons ? n.name : undefined}>
                  {content}
                </ExternalLink>
              ) : (
                <a className={cls} href={n.href} title={icons ? n.name : undefined}>
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
