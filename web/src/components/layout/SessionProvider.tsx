'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { clientApi } from '@/lib/api/client';
import type { User } from '@/lib/api/types';
import { hasSessionHint, writeSessionHint } from '@/lib/session-hint';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface SessionValue {
  user: User | null;
  status: Status;
  setUser: (user: User | null) => void;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * État de session côté client. Le cookie de session est httpOnly : le JS ne voit jamais de jeton ;
 * il interroge /auth/user. Rien n'est stocké dans localStorage/sessionStorage.
 * Un visiteur qui ne s'est jamais connecté depuis ce navigateur (pas d'indicateur `pi_signed_in`) est
 * anonyme d'emblée : pas d'appel, donc pas de 401 en console (R14).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    setStatus(u ? 'authenticated' : 'anonymous');
    writeSessionHint(u !== null);
  }, []);

  // Erreur réseau ou 5xx : anonyme pour cet affichage, mais l'indicateur est conservé (seul un 401 l'efface).
  const setUnknown = useCallback(() => {
    setUserState(null);
    setStatus('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await clientApi.getUser();
      setUser(u);
      return u;
    } catch {
      setUnknown();
      return null;
    }
  }, [setUser, setUnknown]);

  useEffect(() => {
    let active = true;
    const load = hasSessionHint() ? clientApi.getUser() : Promise.resolve(null);
    load.then((u) => active && setUser(u)).catch(() => active && setUnknown());
    return () => {
      active = false;
    };
  }, [setUser, setUnknown]);

  const logout = useCallback(async () => {
    try {
      await clientApi.logout();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo(
    () => ({ user, status, setUser, refresh, logout }),
    [user, status, setUser, refresh, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans <SessionProvider>');
  return ctx;
}
