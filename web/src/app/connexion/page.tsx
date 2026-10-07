import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const raw = (await searchParams).redirect;
  const redirect = safeRedirect(Array.isArray(raw) ? raw[0] : raw, '/compte');
  return (
    <AuthShell
      title="Connexion"
      intro="Accédez à votre compte pour gérer vos favoris et vos informations."
      footer={
        <>
          Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
        </>
      }
    >
      <LoginForm redirect={redirect} />
    </AuthShell>
  );
}
