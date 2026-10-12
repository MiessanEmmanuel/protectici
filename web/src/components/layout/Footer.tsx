import Link from 'next/link';
import { formatPhone, telHref } from '@/lib/format';
import { getSiteContact } from '@/lib/site-settings';
import { Container } from '../ui/Container';
import { CookieSettingsButton } from './CookieSettingsButton';
import { NewsletterForm } from './NewsletterForm';

const columns = [
  {
    title: 'Annuaires',
    links: [
      { href: '/annuaire', label: 'Prestataires de sécurité' },
      { href: '/forces-etatiques', label: 'Forces étatiques' },
      { href: '/blog', label: 'Blog et actualités' },
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
      { href: '/qui-sommes-nous', label: 'Qui sommes-nous' },
      { href: '/nos-partenaires', label: 'Nos partenaires' },
      { href: '/nos-clients', label: 'Nos clients' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Informations légales',
    links: [
      { href: '/mentions-legales', label: 'Mentions légales' },
      { href: '/confidentialite', label: 'Politique de confidentialité' },
      { href: '/cgu', label: 'Conditions d’utilisation' },
    ],
  },
];

const linkClass = 'inline-flex min-h-tap items-center text-link-on-night';

export async function Footer() {
  const year = new Date().getFullYear();
  const contact = await getSiteContact();
  return (
    <footer className="mt-16">
      <section aria-labelledby="titre-newsletter" className="bg-primary-soft">
        <Container className="grid gap-4 py-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 id="titre-newsletter" className="text-xl font-bold">
              Restez informé
            </h2>
            <p className="mt-1 max-w-prose text-muted">
              Recevez les nouveaux articles et conseils de sécurité. Un e-mail de confirmation vous
              sera envoyé avant tout abonnement.
            </p>
          </div>
          <NewsletterForm />
        </Container>
      </section>
      <div className="bg-night text-on-night">
        <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-lg font-bold">ProtectIci</p>
            <p className="mt-2 text-sm text-on-night/85">
              La plateforme d’information et de services dédiée à la sécurité et à la sûreté privées
              en Côte d’Ivoire.
            </p>
            <address className="mt-3 text-sm not-italic text-on-night/85">
              <p>{contact.address}</p>
              <p>
                <a href={telHref(contact.phone)} className={linkClass}>
                  {formatPhone(contact.phone)}
                </a>
              </p>
              <p>
                <a href={`mailto:${contact.email}`} className={linkClass}>
                  {contact.email}
                </a>
              </p>
            </address>
            {contact.facebook || contact.linkedin ? (
              <ul className="mt-1 flex gap-4 text-sm">
                {contact.facebook ? (
                  <li>
                    <a href={contact.facebook} rel="noopener noreferrer" className={linkClass}>
                      Facebook
                    </a>
                  </li>
                ) : null}
                {contact.linkedin ? (
                  <li>
                    <a href={contact.linkedin} rel="noopener noreferrer" className={linkClass}>
                      LinkedIn
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-semibold">{col.title}</p>
              <ul className="mt-2 space-y-1">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                {col.title === 'Informations légales' ? (
                  <li>
                    <CookieSettingsButton className={`${linkClass} underline`} />
                  </li>
                ) : null}
              </ul>
            </nav>
          ))}
        </Container>
        <div className="border-t border-on-night/20">
          <Container className="py-4 text-sm text-on-night/85">
            © 2022–{year} ProtectIci — FYG Technologies. Cartes © contributeurs OpenStreetMap.
          </Container>
        </div>
      </div>
    </footer>
  );
}
