import type { Executive } from './api/types';

const POSITIONS: Record<Executive['position'], string> = {
  general_manager: 'Directeur général',
  commercial_manager: 'Responsable commercial',
  operations_manager: 'Responsable des opérations',
  other: 'Autre fonction',
};

export function positionLabel(e: Executive): string {
  return e.position === 'other' && e.position_label ? e.position_label : POSITIONS[e.position];
}
