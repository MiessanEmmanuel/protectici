'use client';

import { useRouter } from 'next/navigation';
import { LocateFixed, Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { NamedSlug } from '@/lib/api/types';
import { geoErrorMessage, getBrowserPosition } from '@/lib/geolocation';
import { buildHref } from '@/lib/search-params';
import { HOME_SEARCH_INPUT_ID } from '../layout/MobileDock';
import { InlineField, inlineControlClasses } from '../ui/InlineField';

interface HeroSearchProps {
  services: NamedSlug[];
  cities: NamedSlug[];
  /** Noms de prestataires proposés en suggestion (populaires). */
  providerNames?: string[];
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Construit l'URL de l'annuaire : un libellé de service exact devient le filtre `service`,
 * tout autre texte devient la recherche libre `q`.
 */
export function heroSearchHref(
  text: string,
  city: string,
  services: NamedSlug[],
  geo?: { lat: number; lng: number },
): string {
  const t = text.trim().slice(0, 100);
  const service = t ? services.find((s) => norm(s.name) === norm(t)) : undefined;
  return buildHref('/annuaire', {
    q: service ? undefined : t,
    service: service?.slug,
    city: geo ? undefined : city,
    lat: geo?.lat,
    lng: geo?.lng,
    sort: geo ? 'distance' : undefined,
  });
}

/**
 * Recherche du hero. Sans JavaScript : formulaire GET classique vers /annuaire (q, city).
 * Avec JavaScript : reconnaissance des services, et « Autour de moi » (géolocalisation sur
 * action explicite) qui mène à la recherche par proximité de l'annuaire.
 */
export function HeroSearch({ services, cities, providerNames = [] }: HeroSearchProps) {
  const router = useRouter();
  const listId = useId();
  const msgId = useId();
  const [text, setText] = useState('');
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(heroSearchHref(text, city, services));
  }

  async function aroundMe() {
    setLocating(true);
    setMessage('Recherche de votre position…');
    try {
      const pos = await getBrowserPosition();
      setMessage('Position utilisée : ouverture des résultats les plus proches.');
      router.push(heroSearchHref(text, city, services, pos));
    } catch (e) {
      setMessage(geoErrorMessage(e));
    } finally {
      setLocating(false);
    }
  }

  const suggestions = [...services.map((s) => s.name), ...providerNames];

  return (
    <div>
      <form
        action="/annuaire"
        method="get"
        role="search"
        aria-label="Rechercher un prestataire"
        onSubmit={onSubmit}
        className="mt-[34px] grid grid-cols-1 bg-white text-ink lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_auto_auto]"
      >
        <InlineField label="Service ou entreprise">
          <input
            id={HOME_SEARCH_INPUT_ID}
            type="search"
            name="q"
            list={listId}
            maxLength={100}
            autoComplete="off"
            placeholder="Gardiennage, alarme, escorte…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inlineControlClasses}
          />
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </InlineField>
        <InlineField label="Ville">
          <select
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inlineControlClasses}
          >
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </InlineField>
        <button
          type="button"
          onClick={() => void aroundMe()}
          disabled={locating}
          aria-describedby={message ? msgId : undefined}
          className="flex min-h-14 items-center justify-center gap-2 border-b-2 border-ink bg-white px-4 text-[0.85rem] font-extrabold text-ink hover:bg-c4 disabled:opacity-70 lg:border-b-0 [&_svg]:size-[18px]"
        >
          <LocateFixed aria-hidden="true" />
          {locating ? 'Localisation…' : 'Autour de moi'}
        </button>
        <button
          type="submit"
          className="inline-flex min-h-14 items-center justify-center gap-2 bg-c3 px-7 py-[18px] text-base font-black text-on-c3 hover:bg-c2 hover:text-on-c2 lg:py-0 [&_svg]:size-[1.15em]"
        >
          <Search aria-hidden="true" />
          Rechercher
        </button>
      </form>
      <p id={msgId} role="status" className="mt-2 min-h-6 text-sm font-semibold">
        {message}
      </p>
    </div>
  );
}
