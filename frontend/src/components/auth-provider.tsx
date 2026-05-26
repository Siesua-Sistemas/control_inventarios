"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getCurrentUser, isAuthenticated, loginUser, logoutUser } from '@/lib/api';

type AuthContextValue = {
  authenticated: boolean;
  loading: boolean;
  user: { id: string } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    setAuthenticated(isAuthenticated());
    setUser(current);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      authenticated,
      loading,
      user,
      login: async (email: string, password: string) => {
        await loginUser(email, password);
        setAuthenticated(true);
        setUser(getCurrentUser());
      },
      logout: async () => {
        await logoutUser();
        setAuthenticated(false);
        setUser(null);
      },
    }),
    [authenticated, loading, user],
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
