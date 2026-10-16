import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
import { Mail, Phone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Container } from '@/components/ui/Container';
import { formatPhone, telHref } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contactez l’équipe ProtectIci : téléphone, e-mail, adresse du siège et formulaire de contact.',
};

const PHONE = '+2250709445111';
const EMAIL = 'info@protectici.ci';

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Écrivez-nous"
        title="Contact"
        intro="Une question, une suggestion ? Écrivez-nous, nous vous répondrons dans les meilleurs délais."
      />
      <Container className="grid gap-10 py-section lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
        <section
          aria-labelledby="contact-details"
          className="self-start bg-c3 p-6 text-on-c3 md:p-8 [&_a]:text-inherit"
        >
          <h2 id="contact-details" className="text-2xl heading-block">
            Nos coordonnées
          </h2>
          <dl className="mt-5">
            <div className="border-t-2 border-current py-3">
              <dt className="eyebrow opacity-85">Téléphone</dt>
              <dd>
                <a
                  href={telHref(PHONE)}
                  className="inline-flex min-h-tap items-center gap-2 text-xl font-black no-underline hover:underline [&_svg]:size-[1em]"
                >
                  <Phone aria-hidden="true" />
                  {formatPhone(PHONE)}
                </a>
              </dd>
            </div>
            <div className="border-t-2 border-current py-3">
              <dt className="eyebrow opacity-85">E-mail</dt>
              <dd>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex min-h-tap items-center gap-2 font-bold break-all no-underline hover:underline [&_svg]:size-[1.1em] [&_svg]:shrink-0"
                >
                  <Mail aria-hidden="true" />
                  {EMAIL}
                </a>
              </dd>
            </div>
            <div className="border-t-2 border-current py-3">
              <dt className="eyebrow opacity-85">Siège</dt>
              <dd className="mt-1 font-bold">Abidjan Plateau, immeuble Eden</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="contact-form" className="border-2 border-ink p-5 md:p-8">
          <h2 id="contact-form" className="mb-6 text-[2rem] heading-block">
            Écrivez-nous
          </h2>
          <ContactForm />
        </section>
      </Container>
    </>
  );
}
