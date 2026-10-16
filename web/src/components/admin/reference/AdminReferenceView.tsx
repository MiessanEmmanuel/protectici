'use client';

import { REFERENCE_LABELS } from '@/lib/labels';
import type { ReferenceResource } from '@/lib/api/types';
import { Tabs } from '../../ui/Tabs';
import { ReferencePanel } from './ReferencePanel';
import { AdminPageHeader } from '../AdminPageHeader';

const RESOURCES = Object.keys(REFERENCE_LABELS) as ReferenceResource[];

export function AdminReferenceView() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader section="Système" title="Référentiels" />
      <p className="text-muted">
        Listes de valeurs utilisées par le site. Une valeur déjà utilisée ne peut pas être supprimée :
        masquez-la pour la retirer des formulaires publics.
      </p>
      <Tabs
        label="Référentiels"
        tabs={RESOURCES.map((r) => ({
          id: r,
          label: REFERENCE_LABELS[r],
          content: <ReferencePanel key={r} resource={r} />,
        }))}
      />
    </div>
  );
}
