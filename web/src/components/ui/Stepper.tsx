import { cn } from './cn';

export interface StepDef {
  id: string;
  label: string;
}

/**
 * Indicateur d'étapes v9 : barre de cases à filets 2 px (faites = bleu, en cours = or),
 * le titre de l'étape est affiché par le formulaire (libellé repris ici pour les lecteurs d'écran) ; étape courante annoncée (aria-current="step").
 */
export function Stepper({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <nav aria-label="Progression du formulaire">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow">
          Étape {current + 1} sur {steps.length}
        </span>
        <span className="sr-only">: {steps[current]?.label}</span>
      </p>
      <ol className="mt-3 flex border-2 border-ink" role="list">
        {steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'h-3 flex-1 border-ink not-last:border-r-2',
              i < current ? 'bg-c1' : i === current ? 'bg-c2' : 'bg-white',
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
