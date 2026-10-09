'use client';

import type { ExecutivePosition } from '@/lib/api/types';
import type { ExecutiveDraft } from '@/lib/establishment-schemas';
import { POSITIONS } from '@/lib/labels';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

export const MAX_EXECUTIVES = 10;

export function emptyExecutive(): ExecutiveDraft {
  return { full_name: '', position: 'general_manager', position_label: '', is_visible: false };
}

interface Props {
  value: ExecutiveDraft[];
  onChange: (next: ExecutiveDraft[]) => void;
  /** Erreurs par champ : `executives.0.full_name`, `executives.0.position_label`… */
  errors: Record<string, string>;
  disabled?: boolean;
  /** Préfixe des identifiants (résumé d'erreurs : `f-executives.0.full_name`). */
  idPrefix?: string;
}

/**
 * Liste dynamique de dirigeants. Par défaut un dirigeant n'est PAS visible publiquement :
 * l'utilisateur doit cocher explicitement la case (security.md §12).
 */
export function ExecutivesEditor({ value, onChange, errors, disabled, idPrefix = 'f-executives' }: Props) {

  function update(i: number, patch: Partial<ExecutiveDraft>) {
    onChange(value.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.executives ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.executives}
        </p>
      ) : null}
      {value.length === 0 ? (
        <p className="text-muted">Aucun dirigeant renseigné pour le moment.</p>
      ) : null}
      <ul className="flex flex-col gap-4" aria-label="Dirigeants">
        {value.map((e, i) => (
          <li key={i} className="rounded-lg border border-line p-4">
            <fieldset className="flex flex-col gap-3" disabled={disabled}>
              <legend className="px-1 font-semibold">Dirigeant {i + 1}</legend>
              <Input
                id={`${idPrefix}.${i}.full_name`}
                label="Nom complet"
                required
                value={e.full_name}
                maxLength={150}
                onChange={(ev) => update(i, { full_name: ev.target.value })}
                error={errors[`executives.${i}.full_name`]}
                autoComplete="off"
              />
              <Select
                id={`${idPrefix}.${i}.position`}
                label="Fonction"
                required
                value={e.position}
                onChange={(ev) => update(i, { position: ev.target.value as ExecutivePosition })}
                error={errors[`executives.${i}.position`]}
              >
                {(Object.keys(POSITIONS) as ExecutivePosition[]).map((p) => (
                  <option key={p} value={p}>
                    {POSITIONS[p]}
                  </option>
                ))}
              </Select>
              {e.position === 'other' ? (
                <Input
                  id={`${idPrefix}.${i}.position_label`}
                  label="Intitulé de la fonction"
                  required
                  value={e.position_label}
                  maxLength={100}
                  onChange={(ev) => update(i, { position_label: ev.target.value })}
                  error={errors[`executives.${i}.position_label`]}
                />
              ) : null}
              <Checkbox
                id={`${idPrefix}.${i}.is_visible`}
                label="Afficher ce dirigeant publiquement sur la fiche"
                checked={e.is_visible}
                onChange={(ev) => update(i, { is_visible: ev.target.checked })}
              />
              <p className="-mt-2 text-sm text-muted">
                Si la case est décochée, le nom reste connu de notre équipe pour la vérification
                mais n’apparaît pas sur la fiche publique.
              </p>
              <div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onChange(value.filter((_, k) => k !== i));
                    document.getElementById(`${idPrefix}-add`)?.focus();
                  }}
                  aria-label={`Retirer le dirigeant ${i + 1}`}
                >
                  Retirer ce dirigeant
                </Button>
              </div>
            </fieldset>
          </li>
        ))}
      </ul>
      <div>
        <Button
          id={`${idPrefix}-add`}
          variant="secondary"
          disabled={disabled || value.length >= MAX_EXECUTIVES}
          onClick={() => onChange([...value, emptyExecutive()])}
        >
          Ajouter un dirigeant
        </Button>
        {value.length >= MAX_EXECUTIVES ? (
          <p className="mt-1 text-sm text-muted">{MAX_EXECUTIVES} dirigeants au maximum.</p>
        ) : null}
      </div>
    </div>
  );
}
