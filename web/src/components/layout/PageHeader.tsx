import type { ReactNode } from 'react';
import { Container } from '../ui/Container';

export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-primary-soft">
      <Container className="py-8">
        {children}
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {intro ? <p className="mt-2 max-w-prose text-muted">{intro}</p> : null}
      </Container>
    </div>
  );
}
