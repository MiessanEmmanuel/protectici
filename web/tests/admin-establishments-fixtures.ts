import type {
  AdminEstablishment,
  AdminEstablishmentRow,
  Paginated,
  ReferenceData,
} from '@/lib/api/types';

export const REFERENCE: ReferenceData = {
  cities: [
    {
      id: 1,
      name: 'Abidjan',
      slug: 'abidjan',
      lat: 5.3,
      lng: -4,
      districts: [{ id: 10, name: 'Plateau', slug: 'plateau', parent_id: null }],
    },
  ],
  company_types: [{ id: 1, slug: 'sarl', name: 'SARL' }],
  service_types: [
    { id: 1, slug: 'gardiennage', name: 'Gardiennage' },
    { id: 2, slug: 'alarme', name: 'Alarme' },
  ],
  state_force_types: [{ id: 1, slug: 'police', name: 'Police' }],
  procedure_types: [],
};

export function establishment(over: Partial<AdminEstablishment> = {}): AdminEstablishment {
  return {
    type: 'provider',
    slug: 'sentinelle',
    id: 7,
    name: 'Sentinelle Sécurité',
    status: 'pending',
    rejection_reason: null,
    is_visible: false,
    is_verified: false,
    is_featured: false,
    submitted_at: '2026-10-01T09:00:00Z',
    reviewed_at: null,
    pending_change_requests: 1,
    description: 'Gardiennage.',
    phone: '+2250709445111',
    phone_alt: null,
    emergency_phone: null,
    email: 'contact@example.test',
    address: null,
    city_id: 1,
    district_id: 10,
    geo_description: null,
    plus_code: null,
    lat: null,
    lng: null,
    submitter_role: 'manager',
    is_in_service: true,
    executives: [
      { id: 1, full_name: 'Awa Koné', position: 'general_manager', position_label: null, is_visible: false },
    ],
    media: [{ id: 1, collection: 'logo', url: 'https://img.example.test/l.webp', alt: 'Logo Sentinelle' }],
    documents: [
      {
        id: 55,
        type: 'rccm_extract',
        original_name: 'rccm.pdf',
        size_bytes: 2048,
        uploaded_at: '2026-10-01T09:05:00Z',
        verified_at: null,
      },
    ],
    change_requests: [
      {
        id: 3,
        changes: { name: { old: 'Sentinelle', new: 'Sentinelle Sécurité' }, rccm: { old: null, new: 'CI-ABJ-2020-B-1' } },
        status: 'pending',
        rejection_reason: null,
        created_at: '2026-10-02T09:00:00Z',
        reviewed_at: null,
      },
    ],
    company_type_ids: [1],
    service_type_ids: [1, 2],
    website_url: null,
    rccm: 'CI-ABJ-2019-B-0001',
    legal_form: 'SARL',
    share_capital: 1000000,
    corporate_purpose: null,
    approval_number: null,
    approval_expires_at: null,
    owner: { id: 4, first_name: 'Awa', last_name: 'Koné', email: 'awa@example.test', phone: null },
    views_count: 12,
    reviewed_by: null,
    audit: [{ event: 'establishment.submitted', user: { name: 'Awa Koné' }, created_at: '2026-10-01T09:00:00Z' }],
    ...over,
  };
}

export function row(over: Partial<AdminEstablishmentRow> = {}): AdminEstablishmentRow {
  return {
    type: 'provider',
    id: 7,
    slug: 'sentinelle',
    name: 'Sentinelle Sécurité',
    status: 'pending',
    is_visible: false,
    is_verified: false,
    is_featured: true,
    city: { name: 'Abidjan' },
    owner: { id: 4, name: 'Awa Koné', email: 'awa@example.test' },
    submitted_at: '2026-10-01T09:00:00Z',
    reviewed_at: null,
    ...over,
  };
}

export function page<T>(data: T[], over: Partial<Paginated<T>['meta']> = {}): Paginated<T> {
  return {
    data,
    meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length, ...over },
    links: { next: null, prev: null },
  };
}
