import {
  BellRing,
  CarFront,
  Cctv,
  ClipboardList,
  Dog,
  Eye,
  FileSearch,
  Flame,
  GraduationCap,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Icône Lucide d'un type de service, déduite de son slug (l'API n'expose pas d'icône). */
const RULES: [RegExp, LucideIcon][] = [
  [/gardiennage-non/, ShieldCheck],
  [/gardiennage-arme/, ShieldAlert],
  [/canine/, Dog],
  [/video|telesurveillance/, Cctv],
  [/alarme|intrusion|acces/, BellRing],
  [/incendie/, Flame],
  [/evenement|steward|hotesse/, Users],
  [/formation/, GraduationCap],
  [/escorte|tracking|vehicule/, CarFront],
  [/investigation|detective/, FileSearch],
  [/informatique|cyber/, Lock],
  [/audit|conseil/, ClipboardList],
  [/rapprochee|protection/, UserRound],
  [/veille/, Eye],
  [/intervention|assistance|crise/, Siren],
];

export function serviceIcon(slug: string): LucideIcon {
  return RULES.find(([re]) => re.test(slug))?.[1] ?? Shield;
}

/** Services mis en avant sur l'accueil (ordre de la maquette v9), complétés par les suivants. */
export const FEATURED_SERVICE_PATTERNS = [
  /^gardiennage-non-arme$/,
  /^gardiennage-arme$/,
  /^videosurveillance$/,
  /alarme/,
  /^securite-evenementielle$/,
  /^formation/,
  /^securite-incendie$/,
];
