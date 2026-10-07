import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Réinitialiser le mot de passe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer', // le jeton figure dans l'URL : ne jamais le transmettre à un tiers
};

type Params = { token?: string | string[]; email?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const p = await searchParams;
  const token = one(p.token);
  const email = one(p.email);
  return (
    <AuthShell
      title="Nouveau mot de passe"
      intro="Choisissez un mot de passe d’au moins 10 caractères."
    >
      <ResetPasswordForm
        token={token && token.length <= 255 ? token : undefined}
        email={email && email.length <= 255 ? email : undefined}
      />
    </AuthShell>
  );
}
