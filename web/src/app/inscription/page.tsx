import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Créer un compte',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      intro="Un compte vous permet d’enregistrer vos prestataires favoris et, bientôt, de publier des avis."
      footer={
        <>
          Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
