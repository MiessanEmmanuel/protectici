'use client';

import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api/client';
import type { AdminUser, AdminUserQuery, Role } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { useResource } from '@/lib/use-async';
import { useSession } from '../../layout/SessionProvider';
import { Badge } from '../../ui/Tag';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { PagerButtons } from '../../ui/PagerButtons';
import { QueryBoundary } from '../../ui/QueryBoundary';
import { Select } from '../../ui/Select';
import { Table, Td, Th, THead, Tr } from '../../ui/Table';
import { flattenError } from './flatten-error';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

type ActiveFilter = '' | '1' | '0';
interface Filters {
  q: string;
  role: '' | Role;
  active: ActiveFilter;
}
const EMPTY: Filters = { q: '', role: '', active: '' };

type Action =
  | { kind: 'role'; user: AdminUser }
  | { kind: 'active'; user: AdminUser }
  | { kind: 'anonymize'; user: AdminUser };

function fullName(u: AdminUser): string {
  return `${u.first_name} ${u.last_name}`.trim();
}

function toQuery(f: Filters, page: number): AdminUserQuery {
  const query: AdminUserQuery = { page };
  const q = f.q.trim();
  if (q) query.q = q;
  if (f.role) query.role = f.role;
  if (f.active) query.is_active = f.active === '1';
  return query;
}

export function AdminUsersView() {
  const { user: me } = useSession();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action | null>(null);
  const [newRole, setNewRole] = useState<Role>('user');
  const [notice, setNotice] = useState<string | null>(null);

  const state = useResource(() => clientApi.adminListUsers(toQuery(applied, page)), [applied, page]);

  function apply(e: FormEvent) {
    e.preventDefault();
    setApplied({ ...draft, q: draft.q.trim() });
    setPage(1);
  }

  function reset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  }

  function replaceRow(updated: AdminUser) {
    if (!state.data) return;
    state.setData({
      ...state.data,
      data: state.data.data.map((u) => (u.id === updated.id ? updated : u)),
    });
  }

  function openRole(u: AdminUser) {
    setNewRole(u.role);
    setAction({ kind: 'role', user: u });
  }

  async function confirmRole(u: AdminUser) {
    try {
      const updated = await clientApi.adminUpdateUser(u.id, { role: newRole });
      replaceRow(updated);
      setNotice(`Rôle de ${fullName(u)} : ${ROLE_LABELS[updated.role]}.`);
    } catch (e) {
      throw flattenError(e);
    }
  }

  async function confirmActive(u: AdminUser) {
    try {
      const updated = await clientApi.adminUpdateUser(u.id, { is_active: !u.is_active });
      replaceRow(updated);
      setNotice(`Compte de ${fullName(u)} : ${updated.is_active ? 'activé' : 'désactivé'}.`);
    } catch (e) {
      throw flattenError(e);
    }
  }

  async function confirmAnonymize(u: AdminUser) {
    try {
      await clientApi.adminAnonymizeUser(u.id, u.email);
    } catch (e) {
      throw flattenError(e, ['confirm_email']);
    }
    setNotice('Compte anonymisé.');
    state.reload();
  }

  const target = action?.user ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Utilisateurs</h1>

      <form
        role="search"
        aria-label="Filtrer les utilisateurs"
        onSubmit={apply}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        noValidate
      >
        <Input
          label="Nom ou e-mail"
          type="search"
          maxLength={100}
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          autoComplete="off"
        />
        <Select
          label="Rôle"
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value as Filters['role'] })}
        >
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          label="Statut du compte"
          value={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.value as ActiveFilter })}
        >
          <option value="">Tous</option>
          <option value="1">Actifs</option>
          <option value="0">Inactifs</option>
        </Select>
        <div className="flex gap-3">
          <Button type="submit">Appliquer</Button>
          <Button variant="secondary" onClick={reset}>
            Réinitialiser
          </Button>
        </div>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-success">
        {notice}
      </p>

      <QueryBoundary state={state} loadingLabel="Chargement des utilisateurs…">
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState title="Aucun utilisateur ne correspond à ces filtres" />
          ) : (
            <div>
              <Table caption="Utilisateurs">
                <THead>
                  <Tr>
                    <Th>Nom</Th>
                    <Th>E-mail</Th>
                    <Th>Rôle</Th>
                    <Th>Compte</Th>
                    <Th>E-mail vérifié</Th>
                    <Th>2FA</Th>
                    <Th>Dernière connexion</Th>
                    <Th>Établissements</Th>
                    <Th>Créé le</Th>
                    <Th>Actions</Th>
                  </Tr>
                </THead>
                <tbody>
                  {list.data.map((u) => {
                    const self = me?.id === u.id;
                    return (
                      <Tr key={u.id}>
                        <Td className="font-semibold">{fullName(u)}</Td>
                        <Td className="break-all">{u.email}</Td>
                        <Td>{ROLE_LABELS[u.role]}</Td>
                        <Td>
                          <Badge tone={u.is_active ? 'success' : 'danger'}>
                            {u.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </Td>
                        <Td>{u.email_verified ? 'Oui' : 'Non'}</Td>
                        <Td>{u.two_factor_enabled ? 'Activée' : 'Non'}</Td>
                        <Td className="whitespace-nowrap">
                          {u.last_login_at ? formatDateTime(u.last_login_at) : 'Jamais'}
                        </Td>
                        <Td>{u.establishments_count}</Td>
                        <Td className="whitespace-nowrap">{formatDateTime(u.created_at)}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={self}
                              title={self ? 'Vous ne pouvez pas modifier votre propre rôle.' : undefined}
                              aria-label={`Changer le rôle de ${fullName(u)}`}
                              onClick={() => openRole(u)}
                            >
                              Changer le rôle
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={self}
                              title={self ? 'Vous ne pouvez pas désactiver votre propre compte.' : undefined}
                              aria-label={`${u.is_active ? 'Désactiver' : 'Activer'} le compte de ${fullName(u)}`}
                              onClick={() => setAction({ kind: 'active', user: u })}
                            >
                              {u.is_active ? 'Désactiver' : 'Activer'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={self}
                              aria-label={`Anonymiser le compte de ${fullName(u)}`}
                              onClick={() => setAction({ kind: 'anonymize', user: u })}
                            >
                              Anonymiser
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <PagerButtons meta={list.meta} onPage={setPage} disabled={state.loading} />
            </div>
          )
        }
      </QueryBoundary>

      {action?.kind === 'role' && target ? (
        <ConfirmDialog
          open
          onClose={() => setAction(null)}
          title="Changer le rôle"
          confirmLabel="Confirmer le changement"
          onConfirm={() => confirmRole(target)}
        >
          <p className="mb-4">
            Modifier le rôle de <strong>{fullName(target)}</strong> ({target.email}). Cette action est
            enregistrée dans le journal d’audit.
          </p>
          <Select
            label="Nouveau rôle"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </ConfirmDialog>
      ) : null}

      {action?.kind === 'active' && target ? (
        <ConfirmDialog
          open
          onClose={() => setAction(null)}
          title={target.is_active ? 'Désactiver le compte' : 'Activer le compte'}
          confirmLabel={target.is_active ? 'Désactiver' : 'Activer'}
          tone={target.is_active ? 'danger' : 'primary'}
          onConfirm={() => confirmActive(target)}
        >
          <p>
            {target.is_active
              ? `${fullName(target)} ne pourra plus se connecter tant que le compte restera désactivé.`
              : `${fullName(target)} pourra de nouveau se connecter.`}
          </p>
        </ConfirmDialog>
      ) : null}

      {action?.kind === 'anonymize' && target ? (
        <ConfirmDialog
          open
          onClose={() => setAction(null)}
          title="Anonymiser le compte"
          confirmLabel="Anonymiser définitivement"
          tone="danger"
          expectedText={target.email}
          expectedLabel="Adresse e-mail du compte"
          onConfirm={() => confirmAnonymize(target)}
        >
          <p>
            <strong>Action irréversible.</strong> Les données personnelles de {fullName(target)} seront
            effacées. L’historique (fiches, avis, journal) est conservé sans lien avec la personne.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
