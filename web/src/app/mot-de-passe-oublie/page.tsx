import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      intro="Saisissez l’adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={<Link href="/connexion">Retour à la connexion</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
