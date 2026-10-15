import type { Api } from '../api/endpoints';

/**
 * Façade de l'API factice chargée À LA DEMANDE : le module des données de démonstration (~180 Ko de source)
 * n'est téléchargé qu'au premier appel, donc jamais en production (NEXT_PUBLIC_USE_MOCKS=0), où il alourdissait
 * le JS de première charge de toutes les pages (≈ 64 Ko gzip).
 *
 * Chaque propriété textuelle se comporte comme une méthode asynchrone ; elle peut être remplacée
 * (vi.spyOn dans les tests) comme sur un objet ordinaire.
 */
function lazyMethod(name: string): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    const { mockApi } = await import('./mock-api');
    const method: unknown = Reflect.get(mockApi, name);
    if (typeof method !== 'function') throw new Error(`Méthode factice inconnue : ${name}`);
    return Reflect.apply(method, mockApi, args);
  };
}

const overrides = new Map<string, unknown>();
const generated = new Map<string, (...args: unknown[]) => Promise<unknown>>();

function current(name: string): unknown {
  if (overrides.has(name)) return overrides.get(name);
  let fn = generated.get(name);
  if (!fn) {
    fn = lazyMethod(name);
    generated.set(name, fn);
  }
  return fn;
}

export const lazyMockApi: Api = new Proxy({} as Api, {
  get(_target, prop) {
    if (typeof prop !== 'string' || prop === 'then') return undefined;
    return current(prop);
  },
  set(_target, prop, value) {
    if (typeof prop === 'string') overrides.set(prop, value);
    return true;
  },
  has: (_target, prop) => typeof prop === 'string' && prop !== 'then',
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop !== 'string' || prop === 'then') return undefined;
    return { value: current(prop), writable: true, enumerable: true, configurable: true };
  },
  defineProperty(_target, prop, descriptor) {
    if (typeof prop === 'string') overrides.set(prop, descriptor.value);
    return true;
  },
  deleteProperty(_target, prop) {
    if (typeof prop === 'string') overrides.delete(prop);
    return true;
  },
});
