import Link from 'next/link';
import { formatPhone, telHref } from '@/lib/format';
import { getSiteContact } from '@/lib/site-settings';
import { CookieSettingsButton } from './CookieSettingsButton';
import { Logo } from './Header';
import { NewsletterForm } from './NewsletterForm';

const columns = [
  {
    title: 'Annuaire',
    links: [
      { href: '/annuaire', label: 'Prestataires' },
      { href: '/forces-etatiques', label: 'Forces de l’État' },
      { href: '/inscription-etablissement', label: 'Inscrire un établissement' },
      { href: '/devis', label: 'Demande de devis' },
      { href: '/dis-moi-tout', label: 'Dis-moi tout' },
    ],
  },
  {
    title: 'ProtectIci',
    links: [
      { href: '/qui-sommes-nous', label: 'Qui sommes-nous' },
      { href: '/nos-partenaires', label: 'Partenaires' },
      { href: '/nos-clients', label: 'Clients' },
      { href: '/blog', label: 'Actualités' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

const link = 'inline-flex min-h-tap items-center text-inherit no-underline hover:underline';
const legalLink =
  'inline-flex min-h-tap items-center text-inherit underline-offset-[0.2em] hover:underline';

/** Pied de page v9 : bande newsletter sable puis aplat nuit (marque, liens, coordonnées, légal). */
export async function Footer() {
  const year = new Date().getFullYear();
  const contact = await getSiteContact();
  return (
    <footer>
      <section
        aria-labelledby="titre-newsletter"
        className="border-t-2 border-ink bg-c4 text-on-c4"
      >
        <div className="wrap grid gap-6 py-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="eyebrow">Newsletter</p>
            <h2 id="titre-newsletter" className="mt-2 text-2xl heading-block">
              Restez informé
            </h2>
            <p className="mt-2 max-w-prose text-ink-2">
              Recevez les nouveaux articles et conseils de sécurité. Un e-mail de confirmation vous
              sera envoyé avant tout abonnement.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </section>
      <div className="bg-c3 text-[0.9rem] text-on-c3">
        <div className="wrap grid grid-cols-1 gap-8 pt-14 pb-7 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <Logo />
            <p className="mt-3.5 max-w-[36ch] opacity-85">
              Première plateforme d’information et de services dédiée à la sécurité et à la sûreté
              privées en Côte d’Ivoire.
            </p>
            {contact.facebook || contact.linkedin ? (
              <ul className="mt-2 flex gap-4">
                {contact.facebook ? (
                  <li>
                    <a href={contact.facebook} rel="noopener noreferrer" className={legalLink}>
                      Facebook
                    </a>
                  </li>
                ) : null}
                {contact.linkedin ? (
                  <li>
                    <a href={contact.linkedin} rel="noopener noreferrer" className={legalLink}>
                      LinkedIn
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="min-w-0">
              <h2 className="mb-3 eyebrow text-[0.78rem]">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="min-w-0">
            <h2 className="mb-3 eyebrow text-[0.78rem]">Nous joindre</h2>
            <address className="[overflow-wrap:anywhere] not-italic">
              <p className="mb-2">{contact.address}</p>
              <p>
                <a href={telHref(contact.phone)} className={link}>
                  {formatPhone(contact.phone)}
                </a>
              </p>
              <p>
                <a href={`mailto:${contact.email}`} className={link}>
                  {contact.email}
                </a>
              </p>
            </address>
          </div>
          <div className="col-span-full flex flex-wrap justify-between gap-3 border-t-2 border-current pt-4 opacity-85">
            <p className="flex min-h-tap items-center">
              © 2022–{year} ProtectIci · FYG Technologies. Cartes © contributeurs OpenStreetMap.
            </p>
            <ul className="flex flex-wrap items-center gap-x-4">
              <li>
                <Link href="/mentions-legales" className={legalLink}>
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className={legalLink}>
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cgu" className={legalLink}>
                  Conditions d’utilisation
                </Link>
              </li>
              <li>
                <CookieSettingsButton className={`${legalLink} underline`} />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
