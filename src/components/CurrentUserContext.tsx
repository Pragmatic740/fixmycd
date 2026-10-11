'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  bio?: string | null;
  emailNotifications?: boolean;
}

interface CurrentUserState {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserState>({
  user: null,
  loading: false,
  refresh: async () => {},
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      setUser(data?.authenticated ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the session once on mount
    void refresh();
  }, [refresh]);

  return <CurrentUserContext.Provider value={{ user, loading, refresh }}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext);
}

export const isModeratorRole = (role?: string | null) => role === 'referee' || role === 'admin' || role === 'super_admin';
export const isAdminRole = (role?: string | null) => role === 'admin' || role === 'super_admin';
