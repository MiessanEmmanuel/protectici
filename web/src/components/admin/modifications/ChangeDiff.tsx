import type { ReferenceData } from '@/lib/api/types';
import { EMPTY_VALUE, fieldLabel, formatChangeValue } from './change-format';

/** Comparaison « ancienne valeur → nouvelle valeur » champ par champ. */
export function ChangeDiff({
  changes,
  reference,
}: {
  changes: Record<string, { old: unknown; new: unknown }>;
  reference?: ReferenceData | null;
}) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return <p className="text-muted">Aucun champ concerné.</p>;
  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([field, change]) => {
        const before = formatChangeValue(field, change.old, reference);
        const after = formatChangeValue(field, change.new, reference);
        return (
          <div key={field} className="rounded-md border border-line bg-white p-3">
            <dt className="font-semibold">{fieldLabel(field)}</dt>
            <dd className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-1.5">
              <span className="text-sm text-muted">Ancienne valeur</span>
              <span className={before === EMPTY_VALUE ? 'text-muted italic' : 'break-words'}>
                {before}
              </span>
              <span className="text-sm text-muted">Nouvelle valeur</span>
              <span
                className={
                  after === EMPTY_VALUE ? 'text-muted italic' : 'font-semibold break-words'
                }
              >
                {after}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
