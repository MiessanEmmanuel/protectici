import type { ExecutivePosition, ProviderDetail, Review } from '../api/types';
import { cities, companyTypes, serviceTypes } from './reference';

/**
 * Prestataires FICTIFS (noms, numéros, RCCM, dirigeants inventés).
 * Numéros au format +225 27 20 00 xx xx (plage non attribuée à titre d'exemple).
 */

interface Seed {
  slug: string;
  name: string;
  city: string;
  district: string | null;
  lat: number;
  lng: number;
  phone: string;
  emergency?: string;
  services: string[];
  types: string[];
  price: number | null;
  verified: boolean;
  featured: boolean;
  views: number;
  email?: string;
  website?: string;
  description: string;
  address: string;
  geo?: string;
  form: string;
  capital: number;
  rccm: string;
  approval: string;
  purpose: string;
  execs: { name: string; pos: ExecutivePosition; label?: string }[];
  reviews: number;
}

const seeds: Seed[] = [
  {
    slug: 'sentinelle-securite-abidjan',
    name: 'Sentinelle Sécurité Abidjan',
    city: 'abidjan',
    district: 'plateau',
    lat: 5.3236,
    lng: -4.021,
    phone: '+2252720000101',
    emergency: '+2252720000199',
    services: ['gardiennage-arme', 'gardiennage-non-arme', 'videosurveillance', 'controle-d-acces'],
    types: ['entreprise-de-securite-privee'],
    price: 150000,
    verified: true,
    featured: true,
    views: 1840,
    email: 'contact@sentinelle.example.test',
    website: 'https://sentinelle.example.test',
    description:
      "Entreprise de gardiennage active dans le quartier des affaires d'Abidjan. Nos agents sont formés, équipés et encadrés par des superviseurs de terrain. Nous protégeons bureaux, banques et résidences, avec un suivi quotidien des rondes.",
    address: "Avenue Franchet d'Esperey, immeuble Les Arcades, 3e étage",
    geo: "Près de la Place de la République, en face de l'ancienne gare routière.",
    form: 'SARL',
    capital: 10000000,
    rccm: 'CI-ABJ-2019-B-00001',
    approval: 'AGR-DEMO-0001',
    purpose: 'Gardiennage, surveillance et protection de sites privés et professionnels.',
    execs: [
      { name: 'Koffi Yao Désiré', pos: 'general_manager' },
      { name: 'Aïcha Traoré', pos: 'operations_manager' },
    ],
    reviews: 6,
  },
  {
    slug: 'bouclier-ivoire-protection',
    name: 'Bouclier Ivoire Protection',
    city: 'abidjan',
    district: 'riviera-palmeraie',
    lat: 5.3675,
    lng: -3.9578,
    phone: '+2252720000102',
    services: ['protection-rapprochee', 'escorte-et-transport-de-fonds', 'securite-evenementielle'],
    types: ['entreprise-de-securite-privee'],
    price: 250000,
    verified: true,
    featured: true,
    views: 1320,
    email: 'info@bouclier.example.test',
    description:
      "Spécialiste de la protection rapprochée et de l'escorte de personnalités, de convois et de transports de valeurs. Équipes disponibles de jour comme de nuit, véhicules sécurisés et procédures éprouvées.",
    address: 'Boulevard de la Riviera Palmeraie, lot 14',
    geo: 'Derrière la station de la Riviera Palmeraie.',
    form: 'SA',
    capital: 50000000,
    rccm: 'CI-ABJ-2017-B-00002',
    approval: 'AGR-DEMO-0002',
    purpose: 'Protection rapprochée, escorte et sécurité événementielle.',
    execs: [{ name: 'Mamadou Konaté', pos: 'general_manager' }],
    reviews: 5,
  },
  {
    slug: 'cerbere-brigade-canine',
    name: 'Cerbère Brigade Canine',
    city: 'abidjan',
    district: 'yopougon',
    lat: 5.34,
    lng: -4.08,
    phone: '+2252720000103',
    services: ['brigade-canine', 'gardiennage-non-arme', 'detection-de-metaux'],
    types: ['entreprise-de-securite-privee'],
    price: 120000,
    verified: true,
    featured: false,
    views: 640,
    description:
      'Maîtres-chiens professionnels et chiens dressés à la garde et à la détection. Interventions sur entrepôts, chantiers et sites industriels, avec visites de contrôle régulières.',
    address: 'Zone industrielle de Yopougon, route de Niangon',
    form: 'SARL',
    capital: 5000000,
    rccm: 'CI-ABJ-2020-B-00003',
    approval: 'AGR-DEMO-0003',
    purpose: 'Gardiennage avec brigade canine et détection.',
    execs: [{ name: 'Seydou Coulibaly', pos: 'general_manager' }],
    reviews: 3,
  },
  {
    slug: 'vigie-telesurveillance',
    name: 'Vigie Télésurveillance',
    city: 'abidjan',
    district: 'zone-4',
    lat: 5.299,
    lng: -3.981,
    phone: '+2252720000104',
    emergency: '+2252720000198',
    services: ['telesurveillance', 'videosurveillance', 'alarme-anti-intrusion'],
    types: ['entreprise-de-securite-privee'],
    price: 45000,
    verified: true,
    featured: true,
    views: 980,
    email: 'centrale@vigie.example.test',
    website: 'https://vigie.example.test',
    description:
      "Centrale de télésurveillance opérationnelle 24 h/24 : réception des alarmes, levée de doute vidéo et envoi d'une équipe d'intervention. Abonnements adaptés aux commerces et aux particuliers.",
    address: 'Rue du Canal, Zone 4, immeuble Phare',
    geo: 'Proche du centre commercial de la Zone 4.',
    form: 'SAS',
    capital: 20000000,
    rccm: 'CI-ABJ-2018-B-00004',
    approval: 'AGR-DEMO-0004',
    purpose: 'Télésurveillance, vidéosurveillance et intervention sur alarme.',
    execs: [
      { name: 'Nathalie Ouattara', pos: 'general_manager' },
      { name: 'Ibrahim Diabaté', pos: 'commercial_manager' },
    ],
    reviews: 7,
  },
  {
    slug: 'atlas-gardiennage',
    name: 'Atlas Gardiennage',
    city: 'abidjan',
    district: 'abobo',
    lat: 5.416,
    lng: -4.02,
    phone: '+2252720000105',
    services: ['gardiennage-non-arme', 'securite-des-chantiers', 'securite-des-domiciles'],
    types: ['entreprise-de-securite-privee'],
    price: 90000,
    verified: false,
    featured: false,
    views: 310,
    description:
      'Gardiennage de proximité pour chantiers, immeubles et domiciles. Agents recrutés localement, rotations ajustées à vos horaires et rapport écrit hebdomadaire.',
    address: 'Abobo Gare, rue principale, face au marché',
    form: 'Entreprise individuelle',
    capital: 1000000,
    rccm: 'CI-ABJ-2021-A-00005',
    approval: 'AGR-DEMO-0005',
    purpose: 'Gardiennage de chantiers et de résidences.',
    execs: [{ name: 'Moussa Sanogo', pos: 'general_manager' }],
    reviews: 2,
  },
  {
    slug: 'kalao-securite-evenementielle',
    name: 'Kalao Sécurité Événementielle',
    city: 'abidjan',
    district: 'cocody',
    lat: 5.36,
    lng: -3.99,
    phone: '+2252720000106',
    services: ['securite-evenementielle', 'controle-d-acces', 'gestion-de-crise'],
    types: ['entreprise-de-securite-privee'],
    price: 200000,
    verified: true,
    featured: false,
    views: 540,
    description:
      "Sécurisation de concerts, mariages, salons et rencontres sportives : plan de sûreté, filtrage des entrées, gestion des flux et coordination avec les forces de l'ordre.",
    address: 'Cocody, boulevard Latrille, résidence Les Orchidées',
    form: 'SARL',
    capital: 8000000,
    rccm: 'CI-ABJ-2019-B-00006',
    approval: 'AGR-DEMO-0006',
    purpose: "Sûreté d'événements publics et privés.",
    execs: [
      { name: 'Fatoumata Bamba', pos: 'general_manager' },
      { name: 'Jean-Marc Ahoussi', pos: 'other', label: 'Responsable des plans de sûreté' },
    ],
    reviews: 4,
  },
  {
    slug: 'lagune-alarmes-et-acces',
    name: 'Lagune Alarmes & Accès',
    city: 'abidjan',
    district: 'treichville',
    lat: 5.295,
    lng: -4.01,
    phone: '+2252720000107',
    services: [
      'alarme-anti-intrusion',
      'controle-d-acces',
      'clotures-electrifiees',
      'maintenance-de-systemes-de-securite',
    ],
    types: ['vendeur-de-materiel', 'entreprise-de-securite-privee'],
    price: 75000,
    verified: true,
    featured: false,
    views: 420,
    email: 'devis@lagune.example.test',
    website: 'https://lagune.example.test',
    description:
      "Installation et maintenance d'alarmes, de contrôles d'accès par badge ou biométrie et de clôtures électrifiées. Devis gratuit, garantie sur le matériel et contrat de maintenance annuel.",
    address: 'Treichville, avenue 21, rue 12',
    form: 'SARL',
    capital: 6000000,
    rccm: 'CI-ABJ-2016-B-00007',
    approval: 'AGR-DEMO-0007',
    purpose: 'Installation et maintenance de systèmes de sûreté électronique.',
    execs: [{ name: 'Brice Gnagne', pos: 'general_manager' }],
    reviews: 5,
  },
  {
    slug: 'academie-ivoirienne-de-surete',
    name: 'Académie Ivoirienne de Sûreté',
    city: 'abidjan',
    district: 'angre',
    lat: 5.4,
    lng: -3.98,
    phone: '+2252720000108',
    services: ['formation-et-certification', 'audit-et-conseil-en-surete', 'securite-incendie'],
    types: ['centre-de-formation'],
    price: 60000,
    verified: true,
    featured: false,
    views: 370,
    website: 'https://academie.example.test',
    description:
      "Centre de formation des agents de sécurité : secourisme, lutte contre l'incendie, techniques de surveillance, déontologie. Sessions certifiantes et formations à la carte pour entreprises.",
    address: 'Angré 8e tranche, rue des écoles',
    form: 'Association',
    capital: 0,
    rccm: 'CI-ABJ-2015-D-00008',
    approval: 'AGR-DEMO-0008',
    purpose: 'Formation et certification des métiers de la sécurité privée.',
    execs: [{ name: 'Dr Adjoua Kouassi', pos: 'general_manager' }],
    reviews: 4,
  },
  {
    slug: 'securi-materiel-ci',
    name: 'Sécuri-Matériel CI',
    city: 'abidjan',
    district: 'adjame',
    lat: 5.35,
    lng: -4.03,
    phone: '+2252720000109',
    services: ['vente-de-materiel-de-securite', 'videosurveillance', 'detection-de-metaux'],
    types: ['vendeur-de-materiel'],
    price: null,
    verified: false,
    featured: false,
    views: 205,
    description:
      'Boutique de matériel de sécurité : caméras, détecteurs, serrures, extincteurs, tenues et accessoires pour agents. Conseils d’installation et livraison dans le Grand Abidjan.',
    address: 'Adjamé, quartier du marché Liberté',
    form: 'Entreprise individuelle',
    capital: 2000000,
    rccm: 'CI-ABJ-2022-A-00009',
    approval: 'AGR-DEMO-0009',
    purpose: 'Vente de matériel et accessoires de sécurité.',
    execs: [{ name: 'Lassina Doumbia', pos: 'commercial_manager' }],
    reviews: 2,
  },
  {
    slug: 'horizon-investigation-privee',
    name: 'Horizon Investigation Privée',
    city: 'abidjan',
    district: 'marcory',
    lat: 5.305,
    lng: -3.995,
    phone: '+2252720000110',
    services: ['investigation-privee', 'audit-et-conseil-en-surete', 'cybersecurite'],
    types: ['cabinet-de-conseil-et-d-audit'],
    price: 300000,
    verified: true,
    featured: false,
    views: 260,
    description:
      "Cabinet d'enquêtes et de conseil : vérifications préalables, enquêtes internes, audit de sûreté et sensibilisation des équipes aux risques numériques. Discrétion et confidentialité garanties.",
    address: 'Marcory, boulevard Valéry Giscard d’Estaing',
    form: 'SARL',
    capital: 7000000,
    rccm: 'CI-ABJ-2018-B-00010',
    approval: 'AGR-DEMO-0010',
    purpose: 'Enquêtes privées, audit de sûreté et conseil.',
    execs: [{ name: 'Rosine Tano', pos: 'general_manager' }],
    reviews: 3,
  },
  {
    slug: 'flamme-securite-incendie',
    name: 'Flamme Sécurité Incendie',
    city: 'bouake',
    district: 'centre-ville-de-bouake',
    lat: 7.69,
    lng: -5.03,
    phone: '+2252720000111',
    services: [
      'securite-incendie',
      'formation-et-certification',
      'maintenance-de-systemes-de-securite',
    ],
    types: ['entreprise-de-securite-privee'],
    price: 80000,
    verified: true,
    featured: false,
    views: 190,
    description:
      "Prévention et lutte contre l'incendie dans le centre du pays : vérification d'extincteurs, plans d'évacuation, exercices et formation des équipes de première intervention.",
    address: 'Bouaké, avenue de la Paix, près de la préfecture',
    form: 'SARL',
    capital: 4000000,
    rccm: 'CI-BKE-2020-B-00011',
    approval: 'AGR-DEMO-0011',
    purpose: 'Sécurité incendie, maintenance et formation.',
    execs: [{ name: 'Yves Kouadio', pos: 'general_manager' }],
    reviews: 3,
  },
  {
    slug: 'savane-protection-rapprochee',
    name: 'Savane Protection Rapprochée',
    city: 'yamoussoukro',
    district: 'centre-de-yamoussoukro',
    lat: 6.82,
    lng: -5.276,
    phone: '+2252720000112',
    services: ['protection-rapprochee', 'securite-hoteliere', 'gardiennage-arme'],
    types: ['entreprise-de-securite-privee'],
    price: 180000,
    verified: false,
    featured: false,
    views: 140,
    description:
      'Agents de protection pour délégations, hôtels et séminaires à Yamoussoukro. Interventions planifiées et astreinte téléphonique, avec reporting après chaque mission.',
    address: 'Yamoussoukro, quartier Habitat, rue des hôtels',
    form: 'SARL',
    capital: 3000000,
    rccm: 'CI-YAK-2021-B-00012',
    approval: 'AGR-DEMO-0012',
    purpose: 'Protection de personnes et sécurité hôtelière.',
    execs: [{ name: 'Charlotte Zadi', pos: 'general_manager' }],
    reviews: 2,
  },
];

const reviewTemplates: Omit<Review, 'id' | 'created_at'>[] = [
  {
    rating: 5,
    title: 'Très professionnels',
    body: 'Équipe ponctuelle et sérieuse. Les agents sont bien tenus et attentifs. Je recommande sans hésiter.',
    author: 'Awa K.',
    provider_reply: 'Merci pour votre confiance, nous restons à votre écoute.',
    provider_replied_at: '2026-09-02T09:00:00Z',
  },
  {
    rating: 4,
    title: 'Bon rapport qualité-prix',
    body: 'Intervention rapide après notre appel. Quelques retards de facturation, mais le service sur le terrain est très correct.',
    author: 'Jean-Baptiste T.',
    provider_reply: null,
    provider_replied_at: null,
  },
  {
    rating: 5,
    title: null,
    body: 'Un accompagnement de qualité, des réponses claires à toutes nos questions avant la signature du contrat.',
    author: 'Mariam D.',
    provider_reply: null,
    provider_replied_at: null,
  },
  {
    rating: 3,
    title: 'Correct mais perfectible',
    body: "Le service est satisfaisant, mais la communication pourrait être plus régulière en cas de changement d'équipe.",
    author: 'Serge A.',
    provider_reply: 'Nous prenons note de votre remarque et améliorons notre suivi.',
    provider_replied_at: '2026-08-20T14:30:00Z',
  },
  {
    rating: 5,
    title: 'Réactivité exemplaire',
    body: "Une alerte en pleine nuit : l'équipe était sur place en moins de vingt minutes. Très rassurant.",
    author: 'Clarisse N.',
    provider_reply: null,
    provider_replied_at: null,
  },
  {
    rating: 4,
    title: null,
    body: 'Matériel de bonne qualité et installation propre. Le technicien a pris le temps de nous former.',
    author: 'Patrick G.',
    provider_reply: null,
    provider_replied_at: null,
  },
  {
    rating: 2,
    title: 'Déçu du suivi',
    body: 'Le contrat était clair mais le suivi après installation a manqué. Un effort a été fait après mon relevé de remarques.',
    author: 'Hervé L.',
    provider_reply: 'Nous sommes désolés et avons corrigé la situation avec vous.',
    provider_replied_at: '2026-07-11T10:15:00Z',
  },
  {
    rating: 5,
    title: 'Je recommande',
    body: 'Sérieux, discrets et efficaces. Nos locaux sont bien mieux protégés depuis leur arrivée.',
    author: 'Estelle B.',
    provider_reply: null,
    provider_replied_at: null,
  },
];

export const reviewsBySlug: Record<string, Review[]> = {};
let reviewId = 0;
seeds.forEach((seed, index) => {
  reviewsBySlug[seed.slug] = Array.from({ length: seed.reviews }, (_, i) => {
    const tpl = reviewTemplates[(index + i) % reviewTemplates.length]!;
    return {
      ...tpl,
      id: ++reviewId,
      created_at: new Date(Date.UTC(2026, 8, 28 - i * 9 - (index % 5)))
        .toISOString()
        .replace('.000', ''),
    };
  });
});

const serviceBySlug = new Map(serviceTypes.map((s) => [s.slug, s]));
const typeBySlug = new Map(companyTypes.map((t) => [t.slug, t]));

function build(seed: Seed): ProviderDetail {
  const city = cities.find((c) => c.slug === seed.city)!;
  const district = seed.district ? city.districts.find((d) => d.slug === seed.district) : undefined;
  const reviews = reviewsBySlug[seed.slug] ?? [];
  const avg = reviews.length
    ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
    : 0;
  return {
    slug: seed.slug,
    name: seed.name,
    logo_url: null,
    city: { name: city.name, slug: city.slug },
    district: district ? { name: district.name, slug: district.slug } : null,
    phone: seed.phone,
    services: seed.services.map((s) => {
      const svc = serviceBySlug.get(s);
      if (!svc) throw new Error(`Service inconnu dans les fixtures : ${s}`);
      return { slug: svc.slug, name: svc.name };
    }),
    price_from: seed.price,
    rating_avg: avg,
    rating_count: reviews.length,
    is_verified: seed.verified,
    is_featured: seed.featured,
    lat: seed.lat,
    lng: seed.lng,
    distance_m: null,
    description: seed.description,
    address: seed.address,
    geo_description: seed.geo ?? null,
    plus_code: null,
    email: seed.email ?? null,
    website_url: seed.website ?? null,
    emergency_phone: seed.emergency ?? null,
    socials: {
      facebook: seed.website ? 'https://www.facebook.com/exemple.protectici' : null,
      instagram: null,
      twitter: null,
      linkedin: seed.website ? 'https://www.linkedin.com/company/exemple-protectici' : null,
      whatsapp: seed.verified ? seed.phone.replace('+', 'https://wa.me/') : null,
    },
    company_types: seed.types.map((t) => {
      const type = typeBySlug.get(t);
      if (!type) throw new Error(`Type inconnu dans les fixtures : ${t}`);
      return type;
    }),
    legal: {
      legal_form: seed.form,
      share_capital: seed.capital > 0 ? seed.capital : null,
      rccm: seed.rccm,
      approval_number: seed.approval,
      corporate_purpose: seed.purpose,
    },
    executives: seed.execs.map((e) => ({
      full_name: e.name,
      position: e.pos,
      position_label: e.label ?? null,
    })),
    gallery: [],
    views_count: seed.views,
    is_favorite: null,
  };
}

export const providers: ProviderDetail[] = seeds.map(build);
