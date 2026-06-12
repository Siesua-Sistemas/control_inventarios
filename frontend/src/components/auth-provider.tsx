"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getCurrentUser, getMe, isAuthenticated, loginUser, logoutUser, type MeResponse } from '@/lib/api';

type AuthContextValue = {
  authenticated: boolean;
  loading: boolean;
  user: { id: string } | null;
  profile: MeResponse | null;
  permissions: string[];
  roles: string[];
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);

  const loadProfile = async () => {
    try {
      const me = await getMe();
      setProfile(me);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    const current = getCurrentUser();
    const authed = isAuthenticated();
    setAuthenticated(authed);
    setUser(current);
    if (authed) {
      loadProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      loading,
      user,
      profile,
      permissions: profile?.permissions ?? [],
      roles: profile?.roles ?? [],
      hasPermission: (code: string) => profile?.permissions.includes(code) ?? false,
      hasAnyPermission: (codes: string[]) => codes.some((code) => profile?.permissions.includes(code) ?? false),
      login: async (email: string, password: string) => {
        await loginUser(email, password);
        setAuthenticated(true);
        setUser(getCurrentUser());
        await loadProfile();
      },
      logout: async () => {
        await logoutUser();
        setAuthenticated(false);
        setUser(null);
        setProfile(null);
      },
    }),
    [authenticated, loading, user, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
