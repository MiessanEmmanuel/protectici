import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';

export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="flex justify-center py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold">{title}</h1>
        {intro ? <p className="mt-2 text-muted">{intro}</p> : null}
        <Card className="mt-6">{children}</Card>
        {footer ? <p className="mt-4 text-center text-sm">{footer}</p> : null}
      </div>
    </Container>
  );
}
