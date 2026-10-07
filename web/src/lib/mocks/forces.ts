import type { StateForceDetail } from '../api/types';
import { cities, procedureTypes, stateForceTypes } from './reference';

/** Structures étatiques FICTIVES (noms et coordonnées d'exemple). */

interface Seed {
  slug: string;
  name: string;
  type: string;
  city: string;
  district: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  emergency: string | null;
  address: string;
  open24h: boolean;
  hours: string | null;
  procedures: string[];
  description: string;
  email?: string;
  geo?: string;
}

const standard = [
  'deposer-une-plainte',
  'signaler-un-fait-suspect',
  'declaration-de-perte',
  'constat-d-accident',
];

const seeds: Seed[] = [
  {
    slug: 'commissariat-du-plateau',
    name: 'Commissariat de police du Plateau',
    type: 'police-nationale',
    city: 'abidjan',
    district: 'plateau',
    lat: 5.3225,
    lng: -4.0195,
    phone: '+2252720000201',
    emergency: '110',
    address: 'Boulevard de la République',
    open24h: true,
    hours: null,
    procedures: [...standard, 'assistance-pour-une-ceremonie'],
    description:
      'Commissariat chargé de la sécurité publique du quartier des affaires. Accueil du public, dépôt de plainte et traitement des déclarations de perte.',
    geo: 'À proximité du Palais de justice.',
  },
  {
    slug: 'commissariat-de-cocody',
    name: 'Commissariat de police de Cocody',
    type: 'police-nationale',
    city: 'abidjan',
    district: 'cocody',
    lat: 5.3575,
    lng: -3.9945,
    phone: '+2252720000202',
    emergency: '110',
    address: 'Cocody centre, rue des Jardins',
    open24h: true,
    hours: null,
    procedures: standard,
    description:
      'Accueil du public 24 h/24 pour les dépôts de plainte et les signalements. Patrouilles dans les quartiers résidentiels de Cocody.',
  },
  {
    slug: 'commissariat-de-yopougon',
    name: 'Commissariat de police de Yopougon',
    type: 'police-nationale',
    city: 'abidjan',
    district: 'yopougon',
    lat: 5.3365,
    lng: -4.0765,
    phone: '+2252720000203',
    emergency: '110',
    address: 'Yopougon Siporex, carrefour principal',
    open24h: true,
    hours: null,
    procedures: standard,
    description:
      "Commissariat d'arrondissement de la commune de Yopougon : plaintes, mains courantes et constats d'accident.",
  },
  {
    slug: 'brigade-de-gendarmerie-de-bingerville',
    name: 'Brigade de gendarmerie de Bingerville',
    type: 'gendarmerie-nationale',
    city: 'abidjan',
    district: 'bingerville',
    lat: 5.3555,
    lng: -3.8885,
    phone: '+2252720000204',
    emergency: '111',
    address: 'Bingerville, route de la Cité administrative',
    open24h: false,
    hours: 'Tous les jours, de 7 h à 19 h. Permanence téléphonique la nuit.',
    procedures: [...standard, 'assistance-pour-une-ceremonie'],
    description:
      'Brigade territoriale couvrant Bingerville et ses environs. Dépôt de plainte, constats et assistance aux cérémonies sur demande préalable.',
  },
  {
    slug: 'caserne-des-sapeurs-pompiers-de-treichville',
    name: 'Caserne des sapeurs-pompiers de Treichville',
    type: 'sapeurs-pompiers-militaires',
    city: 'abidjan',
    district: 'treichville',
    lat: 5.2935,
    lng: -4.0085,
    phone: '+2252720000205',
    emergency: '180',
    address: 'Treichville, avenue 8',
    open24h: true,
    hours: null,
    procedures: ['signaler-un-fait-suspect', 'constat-d-accident'],
    description:
      "Secours d'urgence, lutte contre l'incendie et assistance aux personnes. Numéro d'urgence joignable à toute heure.",
  },
  {
    slug: 'poste-de-douane-du-port-d-abidjan',
    name: "Poste de douane du port d'Abidjan",
    type: 'douanes',
    city: 'abidjan',
    district: 'port-bouet',
    lat: 5.2545,
    lng: -3.9345,
    phone: '+2252720000206',
    emergency: null,
    address: 'Zone portuaire, entrée principale',
    open24h: false,
    hours: 'Du lundi au vendredi, de 8 h à 16 h.',
    procedures: ['signaler-un-fait-suspect', 'declaration-de-perte'],
    description:
      'Poste de contrôle douanier de la zone portuaire. Signalement de marchandises suspectes et renseignements aux professionnels.',
  },
  {
    slug: 'commissariat-central-de-bouake',
    name: 'Commissariat central de Bouaké',
    type: 'police-nationale',
    city: 'bouake',
    district: 'centre-ville-de-bouake',
    lat: 7.6885,
    lng: -5.0285,
    phone: '+2252720000207',
    emergency: '110',
    address: 'Bouaké, avenue Houphouët-Boigny',
    open24h: true,
    hours: null,
    procedures: [...standard, 'assistance-pour-une-ceremonie'],
    description:
      "Commissariat central de la ville de Bouaké : accueil du public, plaintes, déclarations de perte et constats d'accident.",
  },
  {
    slug: 'police-municipale-de-yamoussoukro',
    name: 'Police municipale de Yamoussoukro',
    type: 'police-municipale',
    city: 'yamoussoukro',
    district: 'centre-de-yamoussoukro',
    lat: 6.8245,
    lng: -5.2745,
    phone: null,
    emergency: null,
    address: 'Yamoussoukro, hôtel de ville',
    open24h: false,
    hours: 'Du lundi au samedi, de 8 h à 17 h.',
    procedures: ['signaler-un-fait-suspect', 'assistance-pour-une-ceremonie'],
    description:
      "Police municipale chargée du respect des arrêtés communaux, de la circulation et de l'encadrement des manifestations.",
  },
];

const typeBySlug = new Map(stateForceTypes.map((t) => [t.slug, t]));
const procBySlug = new Map(procedureTypes.map((p) => [p.slug, p]));

export const stateForces: StateForceDetail[] = seeds.map((s) => {
  const city = cities.find((c) => c.slug === s.city)!;
  const district = s.district ? city.districts.find((d) => d.slug === s.district) : undefined;
  const forceType = typeBySlug.get(s.type);
  if (!forceType) throw new Error(`Type de force inconnu : ${s.type}`);
  return {
    slug: s.slug,
    name: s.name,
    force_type: forceType,
    phone: s.phone,
    emergency_phone: s.emergency,
    city: { name: city.name, slug: city.slug },
    district: district ? { name: district.name, slug: district.slug } : null,
    address: s.address,
    is_open_24h: s.open24h,
    lat: s.lat,
    lng: s.lng,
    distance_m: null,
    description: s.description,
    email: s.email ?? null,
    geo_description: s.geo ?? null,
    plus_code: null,
    opening_hours: s.open24h ? 'Ouvert 24 h/24, 7 j/7' : s.hours,
    procedures: s.procedures.map((slug) => {
      const proc = procBySlug.get(slug);
      if (!proc) throw new Error(`Démarche inconnue : ${slug}`);
      return { slug: proc.slug, name: proc.name, notes: null };
    }),
  };
});
