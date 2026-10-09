import { describe, expect, it } from 'vitest';
import {
  buildCreateInput,
  emptyDraft,
  normalizePhone,
  stepsFor,
  validateStep,
  type EstablishmentDraft,
} from '@/lib/establishment-schemas';
import { buildInfoPatch, toDraft } from '@/components/establishment/manager-utils';

function providerDraft(over: Partial<EstablishmentDraft> = {}): EstablishmentDraft {
  return {
    ...emptyDraft(),
    type: 'provider',
    submitter_role: 'manager',
    name: 'Sentinelle Test',
    company_type_ids: [1],
    service_type_ids: [2],
    city_id: '1',
    phone: '07 09 44 51 11',
    ...over,
  };
}

describe('normalizePhone', () => {
  it('convertit en E.164', () => {
    expect(normalizePhone('07 09 44 51 11')).toBe('+2250709445111');
    expect(normalizePhone('00225 07 09 44 51 11')).toBe('+2250709445111');
    expect(normalizePhone('+225 07 09 44 51 11')).toBe('+2250709445111');
  });
});

describe('étapes', () => {
  it('l’étape légale n’existe que pour un prestataire', () => {
    expect(stepsFor('provider').map((s) => s.id)).toContain('legal');
    expect(stepsFor('state_force').map((s) => s.id)).not.toContain('legal');
    expect(stepsFor('').map((s) => s.id)).toContain('legal');
  });

  it('type : obligatoire', () => {
    const bad = validateStep('type', emptyDraft());
    expect(bad.ok).toBe(false);
    expect(validateStep('type', providerDraft()).ok).toBe(true);
  });

  it('déclarant : qualité obligatoire', () => {
    const bad = validateStep('declarant', providerDraft({ submitter_role: '' }));
    expect(!bad.ok && bad.errors.submitter_role).toBe('Indiquez votre qualité.');
    expect(validateStep('declarant', providerDraft()).ok).toBe(true);
  });

  it('identité prestataire : nom, types et services requis', () => {
    const bad = validateStep('identity', providerDraft({ name: '', company_type_ids: [], service_type_ids: [] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(Object.keys(bad.errors).sort()).toEqual(['company_type_ids', 'name', 'service_type_ids']);
    }
    expect(validateStep('identity', providerDraft()).ok).toBe(true);
  });

  it('identité force étatique : type de structure requis', () => {
    const d = providerDraft({ type: 'state_force', force_type_id: '' });
    const bad = validateStep('identity', d);
    expect(!bad.ok && bad.errors.force_type_id).toBeTruthy();
    expect(validateStep('identity', { ...d, force_type_id: '3' }).ok).toBe(true);
  });

  it('localisation : ville requise, coordonnées par paire', () => {
    expect(validateStep('location', providerDraft({ city_id: '' })).ok).toBe(false);
    const half = validateStep('location', providerDraft({ lat: '5.3' }));
    expect(!half.ok && half.errors.lng).toMatch(/ensemble/);
    expect(validateStep('location', providerDraft({ lat: '5,3', lng: '-4.0' })).ok).toBe(true);
    expect(validateStep('location', providerDraft({ lat: '95', lng: '-4' })).ok).toBe(false);
  });

  it('légal : dirigeant « autre » sans libellé refusé', () => {
    const bad = validateStep(
      'legal',
      providerDraft({
        executives: [{ full_name: 'Awa Koné', position: 'other', position_label: '', is_visible: false }],
      }),
    );
    expect(!bad.ok && bad.errors['executives.0.position_label']).toBe('Précisez la fonction.');
    const ok = validateStep(
      'legal',
      providerDraft({
        executives: [{ full_name: 'Awa Koné', position: 'other', position_label: 'Directrice RH', is_visible: true }],
      }),
    );
    expect(ok.ok).toBe(true);
  });

  it('légal : capital non numérique et date invalides refusés', () => {
    const bad = validateStep('legal', providerDraft({ share_capital: 'abc', approval_expires_at: '12/10/2027' }));
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['approval_expires_at', 'share_capital']);
  });

  it('contacts prestataire : téléphone requis et valide, URL http(s) uniquement', () => {
    expect(validateStep('contacts', providerDraft({ phone: '' })).ok).toBe(false);
    expect(validateStep('contacts', providerDraft({ phone: '123' })).ok).toBe(false);
    const bad = validateStep('contacts', providerDraft({ website_url: 'javascript:alert(1)', email: 'x' }));
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['email', 'website_url']);
    expect(validateStep('contacts', providerDraft()).ok).toBe(true);
  });

  it('contacts force étatique : téléphone facultatif', () => {
    expect(validateStep('contacts', providerDraft({ type: 'state_force', phone: '' })).ok).toBe(true);
  });

  it('justificatifs : 5 fichiers maximum, types contrôlés', () => {
    const pdf = (n: string) => ({ file: new File(['x'], n, { type: 'application/pdf' }), type: 'other' as const });
    expect(validateStep('documents', providerDraft({ documents: [pdf('a.pdf')] })).ok).toBe(true);
    const six = Array.from({ length: 6 }, (_, i) => pdf(`${i}.pdf`));
    expect(validateStep('documents', providerDraft({ documents: six })).ok).toBe(false);
    const exe = { file: new File(['x'], 'a.exe', { type: 'application/x-msdownload' }), type: 'other' as const };
    expect(validateStep('documents', providerDraft({ documents: [exe] })).ok).toBe(false);
  });

  it('récapitulatif : consentement obligatoire', () => {
    expect(validateStep('review', providerDraft()).ok).toBe(false);
    expect(validateStep('review', providerDraft({ consent: true })).ok).toBe(true);
  });
});

describe('corps d’envoi', () => {
  it('buildCreateInput normalise les téléphones et omet les champs vides', () => {
    const input = buildCreateInput(providerDraft({ consent: true, rccm: ' CI-ABJ-1 ' }));
    expect(input).toMatchObject({ type: 'provider', phone: '+2250709445111', rccm: 'CI-ABJ-1', consent: true });
    expect(input.type === 'provider' && input.website_url).toBeUndefined();
  });

  it('buildInfoPatch ne contient jamais de champ sensible', () => {
    const patch = buildInfoPatch(providerDraft({ rccm: 'X', legal_form: 'SARL', share_capital: '10', approval_number: 'A' }));
    for (const f of ['name', 'rccm', 'legal_form', 'share_capital', 'corporate_purpose', 'approval_number', 'force_type_id']) {
      expect(patch).not.toHaveProperty(f);
    }
    const force = buildInfoPatch(providerDraft({ type: 'state_force', force_type_id: '2' }));
    expect(force).not.toHaveProperty('force_type_id');
    expect(force).not.toHaveProperty('name');
  });

  it('toDraft puis buildInfoPatch : un champ vidé part à null', () => {
    const d = toDraft({
      type: 'provider',
      slug: 's',
      name: 'N',
      status: 'approved',
      rejection_reason: null,
      is_visible: true,
      is_verified: false,
      submitted_at: '2026-10-01T00:00:00Z',
      reviewed_at: null,
      pending_change_requests: 0,
      description: 'D',
      phone: '+2250709445111',
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
      submitter_role: 'manager',
      is_in_service: true,
      executives: [],
      media: [],
      documents: [],
      change_requests: [],
    });
    expect(buildInfoPatch({ ...d, description: '' })).toMatchObject({ description: null, city_id: 1, lat: null });
  });
});
