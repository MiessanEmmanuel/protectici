import type { Metadata } from 'next';
import { ContactForm } from '@/components/contact/ContactForm';
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
      <PageHeader title="Contact" intro="Une question, une suggestion ? Écrivez-nous, nous vous répondrons dans les meilleurs délais." />
      <Container className="grid gap-10 py-8 lg:grid-cols-[1fr_2fr]">
        <section aria-labelledby="contact-details" className="flex flex-col gap-4">
          <h2 id="contact-details" className="text-xl font-bold">
            Nos coordonnées
          </h2>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-semibold">Téléphone</dt>
              <dd>
                <a href={telHref(PHONE)}>{formatPhone(PHONE)}</a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">E-mail</dt>
              <dd>
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Siège</dt>
              <dd>Abidjan Plateau, immeuble Eden</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="contact-form" className="flex flex-col gap-4">
          <h2 id="contact-form" className="text-xl font-bold">
            Écrivez-nous
          </h2>
          <ContactForm />
        </section>
      </Container>
    </>
  );
}
