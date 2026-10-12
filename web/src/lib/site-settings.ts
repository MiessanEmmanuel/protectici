import { cache } from 'react';
import { serverApi } from './api/server';
import type { PublicSettings } from './api/types';
import { safe } from './safe';

/** Coordonnées par défaut quand /settings/public est indisponible (valeurs publiques de l'ancien site). */
export const DEFAULT_CONTACT = {
  phone: '+2250709445111',
  email: 'info@protectici.ci',
  address: 'Abidjan Plateau, immeuble Eden',
};

export interface SiteContact {
  phone: string;
  email: string;
  address: string;
  facebook: string | null;
  linkedin: string | null;
}

const httpUrl = (v: string | null | undefined) => (v && /^https?:\/\//i.test(v) ? v : null);

export function contactFromSettings(s: PublicSettings | null): SiteContact {
  return {
    phone: s?.['contact.phone'] || DEFAULT_CONTACT.phone,
    email: s?.['contact.email'] || DEFAULT_CONTACT.email,
    address: s?.['site.address'] || DEFAULT_CONTACT.address,
    facebook: httpUrl(s?.['social.facebook']),
    linkedin: httpUrl(s?.['social.linkedin']),
  };
}

/** Réglages publics, dédupliqués sur la requête (pied de page + page contact). */
export const getSiteContact = cache(async (): Promise<SiteContact> => {
  const [settings] = await safe(serverApi.getPublicSettings());
  return contactFromSettings(settings);
});
