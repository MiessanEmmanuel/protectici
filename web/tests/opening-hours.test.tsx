import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { OpeningHoursEditor } from '@/components/establishment/OpeningHoursEditor';
import {
  buildInfoPatch,
  displayFieldValue,
  toDraft,
} from '@/components/establishment/manager-utils';
import type { MyEstablishment, ReferenceData } from '@/lib/api/types';
import {
  buildCreateInput,
  emptyDraft,
  validateStep,
  type EstablishmentDraft,
} from '@/lib/establishment-schemas';
import {
  formatOpeningHours,
  isValidOpeningHours,
  normalizeOpeningHours,
  openingHoursErrors,
  openingHoursLines,
  openingHoursPayload,
  schemaOrgOpeningHours,
  type OpeningHours,
} from '@/lib/opening-hours';

const WEEK: OpeningHours = {
  mon: [['08:00', '17:00']],
  tue: [['08:00', '17:00']],
  wed: [['08:00', '17:00']],
  thu: [['08:00', '17:00']],
  fri: [['08:00', '17:00']],
  sat: [['08:00', '12:30']],
};

describe('formatOpeningHours et dérivés', () => {
  it('regroupe les jours consécutifs identiques et signale les jours fermés', () => {
    expect(openingHoursLines(WEEK)).toEqual([
      { days: 'Du lundi au vendredi', hours: '8 h – 17 h' },
      { days: 'Samedi', hours: '8 h – 12 h 30' },
      { days: 'Dimanche', hours: 'fermé' },
    ]);
    expect(formatOpeningHours(WEEK)).toBe(
      'Du lundi au vendredi : 8 h – 17 h\nSamedi : 8 h – 12 h 30\nDimanche : fermé',
    );
  });

  it('gère plusieurs plages, deux jours consécutifs, 24 h/24 et l’absence d’horaires', () => {
    expect(
      formatOpeningHours({
        sat: [
          ['08:00', '12:00'],
          ['14:00', '18:00'],
        ],
        sun: [
          ['08:00', '12:00'],
          ['14:00', '18:00'],
        ],
      }),
    ).toBe('Du lundi au vendredi : fermé\nSamedi et dimanche : 8 h – 12 h, 14 h – 18 h');
    expect(formatOpeningHours(WEEK, true)).toBe('Ouvert 24 h/24, 7 j/7');
    expect(formatOpeningHours(null)).toBe('Horaires non communiqués');
    expect(formatOpeningHours({})).toBe('Horaires non communiqués');
    // Ancienne valeur texte ou valeur invalide : jamais de plantage.
    expect(formatOpeningHours('Lundi au vendredi')).toBe('Horaires non communiqués');
    expect(formatOpeningHours({ mon: [['8h', '17h']] })).toBe('Horaires non communiqués');
  });

  it('produit la valeur schema.org', () => {
    expect(schemaOrgOpeningHours(WEEK)).toEqual(['Mo-Fr 08:00-17:00', 'Sa 08:00-12:30']);
    expect(schemaOrgOpeningHours(null, true)).toEqual(['Mo-Su']);
    expect(schemaOrgOpeningHours(null)).toBeUndefined();
  });

  it('valide comme l’API et normalise l’ordre des jours', () => {
    expect(isValidOpeningHours(WEEK)).toBe(true);
    expect(isValidOpeningHours({ lundi: [['08:00', '17:00']] })).toBe(false);
    expect(isValidOpeningHours({ mon: [['08:00']] })).toBe(false);
    expect(isValidOpeningHours({ mon: [['24:00', '25:00']] })).toBe(false);
    expect(isValidOpeningHours({ mon: Array(5).fill(['08:00', '09:00']) })).toBe(false);
    expect(
      Object.keys(
        normalizeOpeningHours({ sat: [['08:00', '12:00']], mon: [['08:00', '12:00']], tue: [] })!,
      ),
    ).toEqual(['mon', 'sat']);
  });

  it('prépare le corps API : jours vides retirés, null si 24 h/24 ou rien de saisi', () => {
    expect(openingHoursPayload({ mon: [['08:00', '17:00']], tue: [] }, false)).toEqual({
      mon: [['08:00', '17:00']],
    });
    expect(openingHoursPayload(WEEK, true)).toBeNull();
    expect(openingHoursPayload({}, false)).toBeNull();
  });

  it('signale heures manquantes, fermeture avant ouverture et chevauchements', () => {
    const errors = openingHoursErrors({
      mon: [['', '17:00']],
      tue: [['17:00', '08:00']],
      wed: [
        ['08:00', '12:00'],
        ['11:00', '15:00'],
      ],
    });
    expect(errors['opening_hours.mon.0.0']).toBe('Indiquez l’heure d’ouverture du lundi.');
    expect(errors['opening_hours.tue.0.1']).toMatch(/postérieure/);
    expect(errors['opening_hours.wed.1.0']).toMatch(/se chevauchent/);
    expect(openingHoursErrors(WEEK)).toEqual({});
  });
});

describe('schémas de l’inscription (force étatique)', () => {
  const force = (patch: Partial<EstablishmentDraft>): EstablishmentDraft => ({
    ...emptyDraft(),
    type: 'state_force',
    name: 'Commissariat test',
    force_type_id: '1',
    city_id: '1',
    ...patch,
  });

  it('envoie le format structuré accepté par l’API', () => {
    const body = buildCreateInput(force({ opening_hours: { ...WEEK, sun: [] } }));
    expect(body).toMatchObject({ opening_hours: WEEK, is_open_24h: false });
    expect(isValidOpeningHours((body as { opening_hours: unknown }).opening_hours)).toBe(true);
    expect(buildCreateInput(force({ opening_hours: WEEK, is_open_24h: true }))).not.toHaveProperty(
      'opening_hours',
      expect.anything(),
    );
  });

  it('refuse une plage incomplète, sauf si l’établissement est ouvert 24 h/24', () => {
    const bad = force({ opening_hours: { mon: [['08:00', '']] } });
    const res = validateStep('contacts', bad);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors['opening_hours.mon.0.1']).toBe('Indiquez l’heure de fermeture du lundi.');
    }
    expect(validateStep('contacts', { ...bad, is_open_24h: true }).ok).toBe(true);
    expect(validateStep('contacts', force({ opening_hours: WEEK })).ok).toBe(true);
  });
});

function forceEstablishment(over: Partial<MyEstablishment> = {}): MyEstablishment {
  // Réponse de MyEstablishmentResource pour une force : pas de clé `executives`.
  return {
    type: 'state_force',
    slug: 'commissariat-test',
    id: 4,
    name: 'Commissariat test',
    status: 'approved',
    description: null,
    phone: null,
    phone_alt: null,
    emergency_phone: null,
    email: null,
    address: null,
    city_id: 1,
    district_id: null,
    geo_description: null,
    plus_code: null,
    lat: null,
    lng: null,
    submitter_role: null,
    is_in_service: true,
    branches: [],
    media: [],
    documents: [],
    change_requests: [],
    force_type_id: 2,
    procedure_type_ids: [3],
    opening_hours: { mon: [['08:00', '17:00']] },
    is_open_24h: false,
    ...over,
  } as MyEstablishment;
}

describe('espace établissement : toDraft et PATCH d’une force étatique (R03, R02)', () => {
  it('ne plante pas sans `executives` et reprend les horaires structurés', () => {
    const est = forceEstablishment();
    expect('executives' in est).toBe(false);
    const draft = toDraft(est);
    expect(draft.executives).toEqual([]);
    expect(draft.opening_hours).toEqual({ mon: [['08:00', '17:00']] });
    expect(toDraft(forceEstablishment({ opening_hours: null })).opening_hours).toEqual({});
  });

  it('envoie les horaires au format de l’API, ou null si ouvert 24 h/24', () => {
    const draft = toDraft(forceEstablishment());
    expect(buildInfoPatch(draft)).toMatchObject({
      opening_hours: { mon: [['08:00', '17:00']] },
      is_open_24h: false,
    });
    expect(buildInfoPatch({ ...draft, is_open_24h: true })).toMatchObject({
      opening_hours: null,
      is_open_24h: true,
    });
  });
});

describe('displayFieldValue (R41)', () => {
  const reference = { state_force_types: [] } as unknown as ReferenceData;
  it('affiche le libellé de la forme juridique au lieu du code', () => {
    expect(displayFieldValue('legal_form', 'sarl', reference)).toBe('SARL');
    expect(displayFieldValue('legal_form', 'ei', reference)).toBe('Entreprise individuelle');
    expect(displayFieldValue('legal_form', null, reference)).toBe('Non renseigné');
  });
});

function Harness({ initial = {} as OpeningHours, errors = {} as Record<string, string> }) {
  const [hours, setHours] = useState<OpeningHours>(initial);
  const [h24, setH24] = useState(false);
  return (
    <>
      <OpeningHoursEditor
        value={hours}
        onChange={setHours}
        isOpen24h={h24}
        onOpen24hChange={setH24}
        errors={errors}
      />
      <output data-testid="value">{JSON.stringify(h24 ? '24h' : hours)}</output>
    </>
  );
}

describe('OpeningHoursEditor', () => {
  const value = () => JSON.parse(screen.getByTestId('value').textContent ?? 'null') as unknown;

  it('ouvre un jour, reprend les horaires du jour précédent, ajoute et retire des plages', async () => {
    const u = userEvent.setup();
    render(<Harness />);
    expect(screen.getAllByText('Fermé')).toHaveLength(7);
    await u.click(screen.getByRole('checkbox', { name: 'Lundi, jour ouvert' }));
    expect(value()).toEqual({ mon: [['08:00', '17:00']] });

    const close = screen.getByLabelText('Fermeture du lundi');
    await u.clear(close);
    await u.type(close, '12:00');
    await u.click(screen.getByRole('button', { name: 'Ajouter une plage horaire au lundi' }));
    expect(screen.getByLabelText('Ouverture du lundi, plage 2')).toHaveValue('');
    await u.type(screen.getByLabelText('Ouverture du lundi, plage 2'), '14:00');
    await u.type(screen.getByLabelText('Fermeture du lundi, plage 2'), '17:00');
    expect(value()).toEqual({
      mon: [
        ['08:00', '12:00'],
        ['14:00', '17:00'],
      ],
    });

    // Le mardi reprend la semaine type du lundi.
    await u.click(screen.getByRole('checkbox', { name: 'Mardi, jour ouvert' }));
    expect(value()).toMatchObject({
      tue: [
        ['08:00', '12:00'],
        ['14:00', '17:00'],
      ],
    });

    await u.click(screen.getByRole('button', { name: 'Retirer la plage 1 du mardi' }));
    expect(value()).toMatchObject({ tue: [['14:00', '17:00']] });
    expect(screen.getByRole('checkbox', { name: 'Mardi, jour ouvert' })).toHaveFocus();

    await u.click(screen.getByRole('checkbox', { name: 'Lundi, jour ouvert' }));
    expect(value()).toEqual({ tue: [['14:00', '17:00']] });
  });

  it('limite à 4 plages par jour et masque le détail quand l’établissement est ouvert 24 h/24', async () => {
    const u = userEvent.setup();
    const four: OpeningHours = {
      fri: [
        ['06:00', '07:00'],
        ['08:00', '09:00'],
        ['10:00', '11:00'],
        ['12:00', '13:00'],
      ],
    };
    render(<Harness initial={four} />);
    expect(
      screen.queryByRole('button', { name: 'Ajouter une plage horaire au vendredi' }),
    ).not.toBeInTheDocument();
    await u.click(screen.getByRole('checkbox', { name: 'Ouvert 24 h sur 24, 7 jours sur 7' }));
    expect(
      screen.queryByRole('checkbox', { name: 'Vendredi, jour ouvert' }),
    ).not.toBeInTheDocument();
    expect(value()).toBe('24h');
  });

  it('affiche les erreurs sous le bon champ', () => {
    render(
      <Harness
        initial={{ mon: [['08:00', '']] }}
        errors={{ 'opening_hours.mon.0.1': 'Indiquez l’heure de fermeture du lundi.' }}
      />,
    );
    expect(screen.getByLabelText('Fermeture du lundi')).toHaveAccessibleDescription(
      'Indiquez l’heure de fermeture du lundi.',
    );
  });
});
