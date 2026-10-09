import { cn } from './cn';

export interface StepDef {
  id: string;
  label: string;
}

/** Indicateur d'étapes : liste ordonnée, étape courante annoncée (aria-current="step"). */
export function Stepper({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <nav aria-label="Progression du formulaire">
      <p className="text-sm font-semibold text-muted">
        Étape {current + 1} sur {steps.length} : <span className="text-ink">{steps[current]?.label}</span>
      </p>
      <ol className="mt-2 flex gap-1.5" role="list">
        {steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'h-2 flex-1 rounded-pill',
              i < current ? 'bg-primary' : i === current ? 'bg-accent' : 'bg-line',
            )}
          >
            <span className="sr-only">
              {s.label}
              {i < current ? ' (terminée)' : i === current ? ' (en cours)' : ''}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
