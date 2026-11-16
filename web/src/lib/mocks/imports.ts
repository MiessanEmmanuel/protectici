import { ApiError } from '../api/errors';
import type {
  AdminImport,
  AdminImportRow,
  ImportsApi,
  ImportRowStatus,
} from '../api/imports';
import type { Paginated } from '../api/types';

/**
 * Imports Excel factices (NEXT_PUBLIC_USE_MOCKS=1) : mêmes formes que le contrat §10.1–10.2.
 * L'analyse et la création sont simulées dans le temps (≈ 3 s chacune) pour montrer le suivi en direct.
 * Données entièrement fictives, aucune donnée sensible.
 */

const PHASE_MS = 3000;
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

interface Rec {
  imp: AdminImport;
  rows: AdminImportRow[];
  analyzedAt: number;
  importedAt: number | null;
}

const NAMES = [
  ['Commissariat du 3e arrondissement', 'Abidjan'],
  ['Brigade de gendarmerie de Bingerville', 'Bingerville'],
  ['Commissariat de Yopougon Sideci', 'Abidjan'],
  ['Poste de police du port', 'San-Pédro'],
  ['Commissariat central de Bouaké', 'Bouaké'],
  ['Brigade de recherches de Daloa', 'Daloa'],
  ['Commissariat de Cocody Angré', 'Abidjan'],
  ['Brigade de gendarmerie de Grand-Bassam', 'Grand-Bassam'],
] as const;

function fakeRows(): AdminImportRow[] {
  const rows: AdminImportRow[] = NAMES.map(([name, city], i) => ({
    line: i + 2,
    name,
    city,
    status: 'valid',
    errors: [],
    duplicate_of: null,
    decision: null,
  }));
  rows.push(
    {
      line: 10,
      name: 'Commissariat du 12e arrondissement',
      city: null,
      status: 'invalid',
      errors: [{ column: 'Ville', message: 'Ville inconnue : Abidajn' }],
      duplicate_of: null,
      decision: null,
    },
    {
      line: 11,
      name: null,
      city: 'Korhogo',
      status: 'invalid',
      errors: [
        { column: 'Nom de la structure', message: 'Ce champ est obligatoire.' },
        { column: 'Téléphone', message: 'Téléphone invalide' },
      ],
      duplicate_of: null,
      decision: null,
    },
    {
      line: 12,
      name: 'Commissariat du 8e arrondissement',
      city: 'Abidjan',
      status: 'duplicate',
      errors: [],
      duplicate_of: { type: 'state_force', id: 1, name: 'Commissariat du 8e arrondissement', city: 'Abidjan', reason: 'name_city' },
      decision: 'skip',
    },
    {
      line: 13,
      name: 'Commissariat de Cocody Angré',
      city: 'Abidjan',
      status: 'duplicate',
      errors: [],
      duplicate_of: { type: 'row', id: 8, name: 'Commissariat de Cocody Angré', city: 'Abidjan', reason: 'file' },
      decision: 'skip',
    },
  );
  return rows;
}

let nextId = 2;
const store: Rec[] = [];

function seed() {
  if (store.length) return;
  const created = '2026-10-20T09:15:00Z';
  const rows = fakeRows();
  store.push({
    imp: {
      id: 1,
      type: 'state_force',
      status: 'done',
      publish_mode: 'publish',
      original_name: 'forces-abidjan-octobre.xlsx',
      rows_total: rows.length,
      rows_valid: 8,
      rows_invalid: 2,
      rows_duplicate: 2,
      rows_created: 8,
      failure_message: null,
      created_by: { id: 1, name: 'Administrateur Démo' },
      created_at: created,
      confirmed_at: '2026-10-20T09:20:00Z',
      finished_at: '2026-10-20T09:21:00Z',
      cancelled_at: null,
      can_confirm: false,
      can_cancel: true,
    },
    rows,
    analyzedAt: 0,
    importedAt: 0,
  });
}

function refresh(rec: Rec): AdminImport {
  const now = Date.now();
  const i = rec.imp;
  if (i.status === 'analyzing' && now >= rec.analyzedAt) {
    i.status = 'ready';
    i.rows_total = rec.rows.length;
    i.rows_valid = rec.rows.filter((r) => r.status === 'valid').length;
    i.rows_invalid = rec.rows.filter((r) => r.status === 'invalid').length;
    i.rows_duplicate = rec.rows.filter((r) => r.status === 'duplicate').length;
  }
  if (i.status === 'importing' && rec.importedAt !== null && now >= rec.importedAt) {
    i.status = 'done';
    i.rows_created = toCreate(rec);
    i.finished_at = new Date().toISOString();
  }
  i.can_confirm = i.status === 'ready' && toCreate(rec) > 0;
  i.can_cancel =
    i.status === 'ready' || i.status === 'failed' || (i.status === 'done' && i.cancelled_at === null);
  return structuredClone(i);
}

function toCreate(rec: Rec): number {
  return rec.rows.filter(
    (r) => r.status === 'valid' || (r.status === 'duplicate' && r.decision === 'create'),
  ).length;
}

function find(id: number): Rec {
  seed();
  const rec = store.find((r) => r.imp.id === id);
  if (!rec) throw new ApiError(404, 'Import introuvable.');
  return rec;
}

function paginate<T>(items: T[], page = 1, perPage = 15): Paginated<T> {
  const last = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), last);
  return {
    data: items.slice((current - 1) * perPage, current * perPage),
    meta: { current_page: current, last_page: last, per_page: perPage, total: items.length },
    links: { next: current < last ? 'next' : null, prev: current > 1 ? 'prev' : null },
  };
}

export const mockImportsApi: ImportsApi = {
  async list(query = {}) {
    seed();
    await delay();
    const items = store
      .filter((r) => !query.type || r.imp.type === query.type)
      .map(refresh)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return paginate(items, query.page);
  },
  async get(id) {
    await delay();
    return refresh(find(id));
  },
  async rows(id, query = {}) {
    await delay();
    const rec = find(id);
    const status: ImportRowStatus | undefined = query.status;
    const items = rec.rows.filter((r) => !status || r.status === status);
    return paginate(structuredClone(items), query.page, Math.min(query.per_page ?? 25, 100));
  },
  async upload({ type, publish_mode, file }) {
    seed();
    await delay(400);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new ApiError(422, 'Le fichier est invalide.', {
        file: ['Le fichier doit être un classeur Excel (.xlsx).'],
      });
    }
    const rec: Rec = {
      imp: {
        id: nextId++,
        type,
        status: 'analyzing',
        publish_mode,
        original_name: file.name,
        rows_total: 0,
        rows_valid: 0,
        rows_invalid: 0,
        rows_duplicate: 0,
        rows_created: 0,
        failure_message: null,
        created_by: { id: 1, name: 'Administrateur Démo' },
        created_at: new Date().toISOString(),
        confirmed_at: null,
        finished_at: null,
        cancelled_at: null,
        can_confirm: false,
        can_cancel: false,
      },
      rows: fakeRows(),
      analyzedAt: Date.now() + PHASE_MS,
      importedAt: null,
    };
    store.push(rec);
    return refresh(rec);
  },
  async decide(id, decisions) {
    await delay();
    const rec = find(id);
    if (refresh(rec).status !== 'ready') {
      throw new ApiError(409, 'Cet import ne peut plus être modifié.');
    }
    for (const d of decisions) {
      const row = rec.rows.find((r) => r.line === d.line && r.status === 'duplicate');
      if (row) row.decision = d.decision;
    }
    return refresh(rec);
  },
  async confirm(id) {
    await delay();
    const rec = find(id);
    const current = refresh(rec);
    if (current.status === 'importing' || current.status === 'done') return current;
    if (!current.can_confirm) throw new ApiError(409, 'Cet import ne peut pas être confirmé.');
    rec.imp.status = 'importing';
    rec.imp.confirmed_at = new Date().toISOString();
    rec.importedAt = Date.now() + PHASE_MS;
    return refresh(rec);
  },
  async cancel(id) {
    await delay();
    const rec = find(id);
    const current = refresh(rec);
    if (!current.can_cancel) throw new ApiError(409, 'Cet import ne peut pas être annulé.');
    let deleted = 0;
    if (current.status === 'done') {
      deleted = rec.imp.rows_created;
      rec.imp.cancelled_at = new Date().toISOString();
    } else {
      rec.imp.status = 'cancelled';
      rec.imp.cancelled_at = new Date().toISOString();
    }
    return { data: refresh(rec), deleted_count: deleted };
  },
};
