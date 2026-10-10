import type { City, Option, ReferenceData } from '../api/types';

/** Données de référence factices (aucune donnée réelle). */

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function options(names: string[], offset = 0): Option[] {
  return names.map((name, i) => ({ id: offset + i + 1, slug: slugify(name), name }));
}

export const serviceTypes: Option[] = [
  { id: 1, slug: 'gardiennage-arme', name: 'Gardiennage armé' },
  { id: 2, slug: 'gardiennage-non-arme', name: 'Gardiennage non armé' },
  ...options(
    [
      'Brigade canine',
      'Vidéosurveillance',
      'Alarme anti-intrusion',
      "Contrôle d'accès",
      'Télésurveillance',
      'Escorte et transport de fonds',
      'Protection rapprochée',
      'Investigation privée',
      'Sécurité incendie',
      'Sécurité événementielle',
      'Sécurité des chantiers',
      'Sécurité bancaire',
      'Sécurité hôtelière',
      'Sécurité des domiciles',
      'Clôtures électrifiées',
      'Détection de métaux',
      'Domotique et sûreté connectée',
      'Cybersécurité',
      'Audit et conseil en sûreté',
      'Formation et certification',
      'Maintenance de systèmes de sécurité',
      'Vente de matériel de sécurité',
      'Gestion de crise',
    ],
    2,
  ),
];

export const companyTypes: Option[] = options([
  'Entreprise de sécurité privée',
  'Centre de formation',
  'Association professionnelle',
  'Vendeur de matériel',
  'Cabinet de conseil et d’audit',
]);

export const stateForceTypes: Option[] = options([
  'Police nationale',
  'Gendarmerie nationale',
  'Sapeurs-pompiers militaires',
  'Douanes',
  'Police municipale',
]);

export const procedureTypes: Option[] = options([
  'Déposer une plainte',
  'Signaler un fait suspect',
  'Déclaration de perte',
  'Constat d’accident',
  'Assistance pour une cérémonie',
]);

let districtId = 0;
function city(
  id: number,
  name: string,
  lat: number,
  lng: number,
  districts: { name: string; parent?: string }[],
): City {
  const built = districts.map((d) => ({
    id: ++districtId,
    name: d.name,
    slug: slugify(d.name),
    parent_id: null as number | null,
  }));
  districts.forEach((d, i) => {
    if (d.parent) built[i]!.parent_id = built.find((b) => b.name === d.parent)?.id ?? null;
  });
  return { id, name, slug: slugify(name), lat, lng, districts: built };
}

export const cities: City[] = [
  city(1, 'Abidjan', 5.3364, -4.0267, [
    { name: 'Plateau' },
    { name: 'Cocody' },
    { name: 'Marcory' },
    { name: 'Treichville' },
    { name: 'Yopougon' },
    { name: 'Abobo' },
    { name: 'Adjamé' },
    { name: 'Koumassi' },
    { name: 'Port-Bouët' },
    { name: 'Attécoubé' },
    { name: 'Bingerville' },
    { name: 'Songon' },
    { name: 'Riviera Palmeraie', parent: 'Cocody' },
    { name: 'Deux-Plateaux', parent: 'Cocody' },
    { name: 'Angré', parent: 'Cocody' },
    { name: 'Zone 4', parent: 'Marcory' },
    { name: 'Biétry', parent: 'Marcory' },
    { name: 'Niangon', parent: 'Yopougon' },
  ]),
  city(2, 'Bouaké', 7.6906, -5.0303, [{ name: 'Centre-ville de Bouaké' }, { name: 'Air France' }]),
  city(3, 'Yamoussoukro', 6.8276, -5.2893, [{ name: 'Centre de Yamoussoukro' }]),
  city(4, 'San-Pédro', 4.7485, -6.6363, [{ name: 'Bardot' }, { name: 'Séwéké' }]),
  city(5, 'Korhogo', 9.458, -5.6295, [{ name: 'Centre de Korhogo' }]),
  city(6, 'Daloa', 6.8774, -6.4502, [{ name: 'Centre de Daloa' }]),
];

export const feedbackTopics: Option[] = options(
  [
    'Courtoisie des agents',
    "Rapidité d'intervention",
    'Disponibilité',
    'Ponctualité',
    'Tenue et propreté des agents',
    'Professionnalisme et qualité du service',
    'Facturation et service après-vente',
    'Autres',
  ],
  0,
);

export const referenceData: ReferenceData = {
  cities,
  company_types: companyTypes,
  service_types: serviceTypes,
  state_force_types: stateForceTypes,
  procedure_types: procedureTypes,
  feedback_topics: feedbackTopics,
};

export function findDistrict(citySlug: string, districtSlug: string) {
  return cities.find((c) => c.slug === citySlug)?.districts.find((d) => d.slug === districtSlug);
}
export function findCityByDistrict(districtSlug: string) {
  const c = cities.find((x) => x.districts.some((d) => d.slug === districtSlug));
  return c ? { city: c, district: c.districts.find((d) => d.slug === districtSlug)! } : null;
}
export { slugify };
