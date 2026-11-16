import type { PartnerType } from '../api/types';

/** Données FICTIVES de la phase 4 (blog, pages, partenaires). Contenu en français, aucune donnée réelle. */

export const NOW_ISO = '2026-10-07T09:00:00Z';

export const categorySeed = [
  {
    slug: 'actualites',
    name: 'Actualités',
    description: 'L’actualité de la sécurité et de la sûreté privées en Côte d’Ivoire.',
  },
  {
    slug: 'anti-intrusion',
    name: 'Anti-intrusion',
    description: 'Alarmes, détecteurs, clôtures et contrôle d’accès pour protéger vos locaux.',
  },
  {
    slug: 'cybercriminalite',
    name: 'Cybercriminalité',
    description: 'Menaces numériques, arnaques en ligne et bonnes pratiques de protection.',
  },
  {
    slug: 'domotique',
    name: 'Domotique',
    description: 'Maison et bureaux connectés : caméras, serrures et automatismes.',
  },
  {
    slug: 'emploi',
    name: 'Emploi',
    description: 'Offres, métiers et conseils pour travailler dans la sécurité privée.',
  },
  {
    slug: 'formation',
    name: 'Formation',
    description: 'Formations, certifications et agréments du secteur.',
  },
  {
    slug: 'securite-incendie',
    name: 'Sécurité incendie',
    description: 'Prévention, détection et lutte contre l’incendie.',
  },
] as const;

export interface PostSeed {
  title: string;
  cat: (typeof categorySeed)[number]['slug'];
  excerpt: string;
  paras: string[];
  status: 'published' | 'draft' | 'scheduled' | 'archived';
  /** Jours avant NOW_ISO (négatif = futur). */
  daysAgo: number;
  views: number;
  featured?: boolean;
  flash?: boolean;
  author?: string;
}

const p = (...t: string[]) => t;

export const postSeeds: PostSeed[] = [
  {
    title: 'Gardiennage : comment choisir une société fiable à Abidjan',
    cat: 'actualites',
    status: 'published',
    daysAgo: 2,
    views: 1240,
    featured: true,
    flash: true,
    author: 'Rédaction ProtectIci',
    excerpt:
      'Agrément, assurance, formation des agents : les points à vérifier avant de confier la surveillance de vos locaux.',
    paras: p(
      'Confier la sécurité de ses locaux à une société de gardiennage est une décision qui engage votre responsabilité. Avant de signer, quelques vérifications simples permettent d’écarter les prestataires peu sérieux.',
      '## Vérifier l’agrément et les assurances',
      'Une société de sécurité privée doit disposer d’un agrément en cours de validité et d’une assurance responsabilité civile professionnelle. Demandez-en une copie et vérifiez les dates.',
      '## Évaluer la formation des agents',
      'Interrogez le prestataire sur la formation initiale et continue de ses agents : secourisme, lutte contre l’incendie, gestion des conflits. Un agent formé réagit mieux et plus vite.',
      'Enfin, comparez plusieurs devis et consultez les avis publiés sur l’annuaire ProtectIci avant de décider.',
    ),
  },
  {
    title: 'Sapeurs-pompiers : les bons réflexes en cas de départ de feu',
    cat: 'securite-incendie',
    status: 'published',
    daysAgo: 3,
    views: 980,
    featured: true,
    flash: true,
    excerpt:
      'Alerter, évacuer, ne pas retourner chercher ses affaires : l’essentiel à retenir pour réagir efficacement.',
    paras: p(
      'Face à un départ de feu, les premières minutes sont décisives. Garder son calme et appliquer quelques gestes simples peut sauver des vies.',
      '## Donner l’alerte',
      'Prévenez immédiatement les occupants et appelez les secours. Précisez l’adresse exacte, la nature du sinistre et la présence éventuelle de personnes bloquées.',
      '## Évacuer sans tarder',
      'Fermez les portes derrière vous pour ralentir la propagation, empruntez les issues de secours et rejoignez le point de rassemblement. Ne reprenez jamais l’ascenseur.',
    ),
  },
  {
    title: 'Hameçonnage par SMS : reconnaître les faux messages de mobile money',
    cat: 'cybercriminalite',
    status: 'published',
    daysAgo: 4,
    views: 2105,
    featured: true,
    excerpt:
      'Faux messages de transfert, liens piégés, demandes de code : comment ne pas vous faire piéger.',
    paras: p(
      'Les escroqueries par SMS visant les services de paiement mobile se multiplient. Les fraudeurs se font passer pour un opérateur ou un proche pour obtenir vos codes.',
      '## Les signes qui doivent alerter',
      'Un message urgent, une faute d’orthographe, un lien raccourci ou une demande de code secret sont autant de signaux d’alerte. Un opérateur ne vous demandera jamais votre code confidentiel.',
      '## Que faire en cas de doute ?',
      'Ne cliquez pas, ne répondez pas, signalez le numéro à votre opérateur et supprimez le message. Si vous avez communiqué un code, contactez immédiatement votre service client.',
    ),
  },
  {
    title: 'Caméras de surveillance : que dit la réglementation sur la vie privée ?',
    cat: 'domotique',
    status: 'published',
    daysAgo: 6,
    views: 760,
    excerpt:
      'Où installer des caméras, comment informer le public et combien de temps conserver les images.',
    paras: p(
      'Installer des caméras de surveillance est légitime, à condition de respecter la vie privée des personnes filmées.',
      '## Informer les personnes filmées',
      'Un panneau visible doit signaler la présence de caméras et indiquer la personne à contacter. Les zones de repos des salariés ne doivent pas être filmées.',
      '## Durée de conservation',
      'Les images ne doivent pas être conservées plus longtemps que nécessaire, généralement quelques semaines au maximum, sauf procédure en cours.',
    ),
  },
  {
    title: 'Alarme anti-intrusion : quel système pour une villa ou un commerce ?',
    cat: 'anti-intrusion',
    status: 'published',
    daysAgo: 8,
    views: 1530,
    flash: false,
    excerpt:
      'Détecteurs d’ouverture, de mouvement, sirène, télésurveillance : comparer les solutions selon votre besoin.',
    paras: p(
      'Le choix d’une alarme dépend de la taille des locaux, de leur occupation et du niveau de risque. Un commerce de centre-ville n’a pas les mêmes besoins qu’une villa en lotissement.',
      '## Les composants de base',
      'Une centrale, des détecteurs d’ouverture sur les accès, des détecteurs de mouvement dans les pièces sensibles et une sirène forment le socle d’une installation.',
      '## Faut-il une télésurveillance ?',
      'Reliée à un centre de supervision, l’alarme déclenche l’intervention d’un agent. Elle est recommandée pour les locaux inoccupés la nuit.',
    ),
  },
  {
    title: 'Devenir agent de sécurité : les étapes pour intégrer le métier',
    cat: 'emploi',
    status: 'published',
    daysAgo: 9,
    views: 1890,
    featured: true,
    excerpt:
      'Conditions d’accès, formation obligatoire, débouchés : le parcours pour devenir agent de sécurité privée.',
    paras: p(
      'Le secteur de la sécurité privée recrute régulièrement. Le métier demande de la rigueur, de la disponibilité et un bon sens relationnel.',
      '## Les conditions d’accès',
      'Il faut généralement être majeur, avoir un casier judiciaire vierge et suivre une formation auprès d’un établissement reconnu.',
      '## Les débouchés',
      'Agent de surveillance, opérateur de télésurveillance, maître-chien ou chef de poste : les évolutions de carrière sont nombreuses.',
    ),
  },
  {
    title: 'Formation SSIAP : à quoi sert-elle et où la suivre ?',
    cat: 'formation',
    status: 'published',
    daysAgo: 11,
    views: 640,
    excerpt:
      'Le service de sécurité incendie et d’assistance aux personnes : contenu, durée et recyclage.',
    paras: p(
      'La formation de sécurité incendie et d’assistance aux personnes prépare les agents à prévenir les risques dans les établissements recevant du public.',
      '## Contenu de la formation',
      'Elle aborde la réglementation, les consignes d’évacuation, l’utilisation des extincteurs et les premiers secours.',
      '## Recyclage',
      'Un recyclage régulier est nécessaire pour maintenir ses compétences à jour. Consultez les centres référencés dans l’annuaire.',
    ),
  },
  {
    title: 'Mots de passe : cinq règles simples pour protéger vos comptes',
    cat: 'cybercriminalite',
    status: 'published',
    daysAgo: 13,
    views: 1320,
    excerpt:
      'Longueur, unicité, gestionnaire, double authentification : les bons réflexes au quotidien.',
    paras: p(
      'Un mot de passe faible est la porte d’entrée préférée des pirates. Quelques habitudes suffisent à réduire fortement le risque.',
      '## Les règles à retenir',
      'Choisissez des mots de passe longs, différents pour chaque service, activez la double authentification et ne les partagez jamais.',
      'Un gestionnaire de mots de passe vous évite de les mémoriser tous.',
    ),
  },
  {
    title: 'Contrôle d’accès : badges, codes ou biométrie, que choisir ?',
    cat: 'anti-intrusion',
    status: 'published',
    daysAgo: 15,
    views: 540,
    excerpt:
      'Avantages et limites des principales technologies de contrôle d’accès pour une entreprise.',
    paras: p(
      'Contrôler qui entre et sort de vos locaux est la première étape d’une sécurité efficace.',
      '## Badges et codes',
      'Les badges sont simples à gérer et à révoquer en cas de perte. Les codes sont économiques mais faciles à partager.',
      '## Biométrie',
      'Empreinte ou reconnaissance faciale offrent un niveau élevé de sécurité, mais imposent des précautions sur les données personnelles.',
    ),
  },
  {
    title: 'Serrure connectée : confort et sécurité réellement au rendez-vous ?',
    cat: 'domotique',
    status: 'published',
    daysAgo: 17,
    views: 410,
    excerpt: 'Ouvrir sa porte avec son téléphone : ce qu’il faut savoir avant de s’équiper.',
    paras: p(
      'Les serrures connectées séduisent par leur praticité : plus de clé à perdre, des accès temporaires pour les visiteurs.',
      '## Les points de vigilance',
      'Vérifiez l’autonomie des piles, la présence d’une clé de secours et la qualité des mises à jour de sécurité fournies par le fabricant.',
    ),
  },
  {
    title: 'Extincteurs : types, emplacements et vérifications périodiques',
    cat: 'securite-incendie',
    status: 'published',
    daysAgo: 19,
    views: 870,
    excerpt: 'Eau, poudre, CO2 : choisir le bon extincteur et le contrôler régulièrement.',
    paras: p(
      'Un extincteur adapté et en bon état est le premier moyen de lutte contre un feu naissant.',
      '## Choisir le bon type',
      'L’extincteur à eau convient aux feux de matières solides, celui au CO2 aux équipements électriques, la poudre à usage polyvalent.',
      '## Contrôles',
      'Faites vérifier vos extincteurs au moins une fois par an par un professionnel et notez la date sur le registre de sécurité.',
    ),
  },
  {
    title: 'Sûreté des événements : organiser la sécurité d’un mariage ou d’un concert',
    cat: 'actualites',
    status: 'published',
    daysAgo: 21,
    views: 590,
    excerpt: 'Agents, gestion des flux, plan d’évacuation : ce qu’il faut prévoir avant le jour J.',
    paras: p(
      'Un rassemblement important exige une préparation sérieuse pour garantir la sécurité du public.',
      '## Évaluer les risques',
      'Capacité de l’accueil, accès pompiers, stationnement et conditions météo sont à analyser en amont.',
      '## Prévoir les moyens humains',
      'Dimensionnez le nombre d’agents selon la fréquentation et briefez-les sur le plan d’évacuation.',
    ),
  },
  {
    title: 'Offres d’emploi : les profils recherchés par les sociétés de sécurité',
    cat: 'emploi',
    status: 'published',
    daysAgo: 24,
    views: 720,
    excerpt:
      'Agents de surveillance, opérateurs vidéo, chefs de site : panorama des métiers qui recrutent.',
    paras: p(
      'Les entreprises référencées sur ProtectIci recrutent des profils variés, du débutant au cadre expérimenté.',
      '## Des métiers accessibles',
      'Plusieurs postes sont ouverts aux candidats motivés, sous réserve de suivre la formation requise.',
    ),
  },
  {
    title: 'Certification des agents : pourquoi elle rassure les clients',
    cat: 'formation',
    status: 'published',
    daysAgo: 27,
    views: 380,
    excerpt: 'Une certification reconnue valorise l’agent et sécurise le donneur d’ordre.',
    paras: p(
      'La certification atteste que l’agent a acquis les compétences attendues et qu’il les maintient dans le temps.',
      'Pour les clients, c’est un gage de qualité qui facilite la comparaison entre prestataires.',
    ),
  },
  {
    title: 'Sécurité de vos données : sauvegardes et bonnes pratiques en entreprise',
    cat: 'cybercriminalite',
    status: 'published',
    daysAgo: 30,
    views: 450,
    excerpt:
      'Sauvegarde externe, mises à jour, sensibilisation du personnel : le socle d’une protection numérique.',
    paras: p(
      'Une attaque par rançongiciel peut paralyser une entreprise en quelques heures. La meilleure défense reste la préparation.',
      '## Sauvegarder régulièrement',
      'Appliquez la règle des trois copies sur deux supports différents, dont une hors site.',
    ),
  },
  {
    title: 'Détecteurs de fumée : où les placer dans un logement ?',
    cat: 'securite-incendie',
    status: 'draft',
    daysAgo: 1,
    views: 0,
    excerpt: 'Chambres, couloirs, séjour : l’emplacement idéal pour être alerté à temps.',
    paras: p(
      'Brouillon : article en cours de rédaction sur l’installation des détecteurs de fumée.',
    ),
  },
  {
    title: 'Vidéosurveillance et télésurveillance : quelle différence ?',
    cat: 'domotique',
    status: 'draft',
    daysAgo: 2,
    views: 0,
    excerpt:
      'Enregistrer des images n’est pas surveiller en temps réel : comprendre les deux approches.',
    paras: p(
      'Brouillon : comparaison entre vidéosurveillance simple et télésurveillance avec levée de doute.',
    ),
  },
  {
    title: 'Bilan de la saison : la sécurité privée en chiffres',
    cat: 'actualites',
    status: 'scheduled',
    daysAgo: -5,
    views: 0,
    excerpt: 'Un panorama du secteur à paraître prochainement.',
    paras: p('Article planifié : publication prévue la semaine prochaine.'),
  },
  {
    title: 'Ancienne réglementation des armes de gardiennage',
    cat: 'actualites',
    status: 'archived',
    daysAgo: 400,
    views: 215,
    excerpt: 'Article archivé : texte remplacé par la réglementation en vigueur.',
    paras: p('Cet article a été archivé car son contenu n’est plus à jour.'),
  },
];

export const pageSeed: Record<string, { title: string; body: string; seo_description: string }> = {
  'qui-sommes-nous': {
    title: 'Qui sommes-nous',
    seo_description:
      'ProtectIci est la plateforme d’information et de services dédiée à la sécurité et à la sûreté privées en Côte d’Ivoire.',
    body: '<h2>Notre mission</h2><p>ProtectIci est la première plateforme d’information et de services en ligne dédiée à la sécurité et à la sûreté privées en Côte d’Ivoire. Conçue en 2022, elle référence les entreprises de sécurité privée, les établissements de formation et les forces étatiques, avec les démarches associées.</p><p>Nous contribuons à la protection des biens et des personnes, à la prévention et à la dissuasion, à la gestion de crise, au contrôle d’accès et à la surveillance, à l’enquête ainsi qu’au conseil et à l’audit.</p><h2>Nos valeurs</h2><ul><li><strong>Intégrité</strong> : des fiches vérifiées par notre équipe avant publication.</li><li><strong>Fiabilité</strong> : une information claire, à jour et sourcée.</li><li><strong>Professionnalisme</strong> : un service attentif aux particuliers comme aux entreprises.</li><li><strong>Prévention</strong> : des conseils pratiques pour anticiper les risques.</li></ul><h2>Qui édite ProtectIci ?</h2><p>La plateforme est éditée par FYG Technologies, dont le siège est situé à Abidjan Plateau, immeuble Eden.</p>',
  },
  'mentions-legales': {
    title: 'Mentions légales',
    seo_description:
      'Mentions légales du site ProtectIci : éditeur, hébergement, propriété intellectuelle.',
    body: '<h2>Éditeur du site</h2><p>Le site ProtectIci est édité par FYG Technologies, société de droit ivoirien, dont le siège est situé à Abidjan Plateau, immeuble Eden. RCCM : CI-ABJ-0000-X-00000 (numéro fictif de démonstration). Agrément : AG-0000 (numéro fictif de démonstration).</p><h2>Contact</h2><p>Pour toute question : <a href="mailto:info@protectici.ci">info@protectici.ci</a>.</p><h2>Hébergement</h2><p>Le site est hébergé sur une infrastructure dédiée, protégée par un service de filtrage du trafic.</p><h2>Propriété intellectuelle</h2><p>Les textes, logos et éléments graphiques sont protégés. Toute reproduction sans autorisation préalable est interdite.</p>',
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    seo_description: 'Comment ProtectIci collecte, utilise et protège vos données personnelles.',
    body: '<h2>Données collectées</h2><p>Nous collectons uniquement les informations nécessaires au fonctionnement du service : coordonnées saisies dans les formulaires, avis, messages et adresse e-mail pour la lettre d’information.</p><h2>Finalités</h2><p>Ces données servent à répondre à vos demandes, modérer les contenus, assurer la sécurité du site et, avec votre accord, vous envoyer notre lettre d’information.</p><h2>Cookies</h2><p>Aucun traceur non essentiel n’est déposé sans votre accord. Vous pouvez modifier votre choix à tout moment depuis le lien « Gérer mes cookies » en bas de page.</p><h2>Vos droits</h2><p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données en écrivant à <a href="mailto:info@protectici.ci">info@protectici.ci</a>.</p>',
  },
  cgu: {
    title: 'Conditions générales d’utilisation',
    seo_description: 'Conditions générales d’utilisation de la plateforme ProtectIci.',
    body: '<h2>Objet</h2><p>Les présentes conditions encadrent l’utilisation de la plateforme ProtectIci, annuaire de prestataires de sécurité privée et de forces étatiques.</p><h2>Contenus des utilisateurs</h2><p>Les avis et commentaires doivent être respectueux, exacts et fondés sur une expérience réelle. Ils sont modérés avant publication.</p><h2>Responsabilité</h2><p>ProtectIci met en relation mais n’est pas partie aux contrats conclus entre utilisateurs et prestataires. Les informations des fiches sont fournies par les établissements et vérifiées avant publication.</p><h2>Évolution des conditions</h2><p>Ces conditions peuvent évoluer ; la date de dernière mise à jour figure en bas de page.</p>',
  },
};

export const partnerSeed: {
  type: PartnerType;
  name: string;
  website_url: string | null;
  description: string;
}[] = [
  {
    type: 'partner',
    name: 'Association des Sapeurs Volontaires',
    website_url: 'https://exemple.test/asv',
    description: 'Sensibilisation à la prévention incendie auprès du grand public.',
  },
  {
    type: 'partner',
    name: 'Centre de Formation Horizon Sûreté',
    website_url: 'https://exemple.test/horizon',
    description: 'Formations initiales et continues pour agents de sécurité.',
  },
  {
    type: 'partner',
    name: 'Réseau Entreprises Plateau',
    website_url: null,
    description: 'Réseau d’entreprises du Plateau engagées pour la sécurité de leurs quartiers.',
  },
  {
    type: 'client',
    name: 'Groupe Hôtelier Lagune',
    website_url: 'https://exemple.test/lagune',
    description: 'Surveillance et contrôle d’accès de plusieurs établissements hôteliers.',
  },
  {
    type: 'client',
    name: 'Marché Moderne de Cocody',
    website_url: null,
    description: 'Gardiennage de jour et de nuit pour un marché couvert.',
  },
  {
    type: 'client',
    name: 'Clinique Les Palmiers',
    website_url: 'https://exemple.test/palmiers',
    description: 'Sécurité incendie et accueil sécurisé des patients.',
  },
];

export const settingsSeed = [
  { key: 'contact.phone', value: '+2250709445111', is_public: true },
  { key: 'contact.email', value: 'info@protectici.ci', is_public: true },
  { key: 'site.address', value: 'Abidjan Plateau, immeuble Eden', is_public: true },
  { key: 'social.facebook', value: 'https://www.facebook.com/protectici', is_public: true },
  { key: 'social.linkedin', value: 'https://www.linkedin.com/company/protectici', is_public: true },
  { key: 'contact.notification_email', value: 'equipe@protectici.ci', is_public: false },
];
