import Link from 'next/link';
import { Container } from '../ui/Container';

const columns = [
  {
    title: 'Annuaires',
    links: [
      { href: '/annuaire', label: 'Prestataires de sécurité' },
      { href: '/forces-etatiques', label: 'Forces étatiques' },
    ],
  },
  {
    title: 'Services',
    links: [
      { href: '/inscription-etablissement', label: 'Inscrire mon établissement' },
      { href: '/devis', label: 'Demande de devis' },
      { href: '/dis-moi-tout', label: 'Dis-moi tout' },
    ],
  },
  {
    title: 'ProtectIci',
    links: [
      { href: '/a-propos', label: 'Qui sommes-nous' },
      { href: '/contact', label: 'Contact' },
      { href: '/mentions-legales', label: 'Mentions légales' },
      { href: '/confidentialite', label: 'Politique de confidentialité' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-night text-on-night">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold">ProtectIci</p>
          <p className="mt-2 text-sm text-on-night/85">
            La plateforme d’information et de services dédiée à la sécurité et à la sûreté privées
            en Côte d’Ivoire.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="font-semibold">{col.title}</p>
            <ul className="mt-2 space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-tap items-center text-link-on-night"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-on-night/20">
        <Container className="py-4 text-sm text-on-night/85">
          © 2022–{year} ProtectIci — FYG Technologies. Cartes © contributeurs OpenStreetMap.
        </Container>
      </div>
    </footer>
  );
}
