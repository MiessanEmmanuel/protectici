import { Container } from '@/components/ui/Container';
import { Skeleton } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <Container className="py-8" aria-busy="true">
      <span className="sr-only" role="status">
        Chargement des résultats…
      </span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-6 h-48 w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </Container>
  );
}
