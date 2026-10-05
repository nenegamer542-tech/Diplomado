import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setTokens, setOnSessionExpired } from '../api/client';
import { clearTokens, loadTokens, saveTokens } from './tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const clearLocalSession = useCallback(async () => {
    setTokens({ access: null, refresh: null });
    await clearTokens();
    setSession(null);
  }, []);

  const logout = useCallback(async ({ callServer = true } = {}) => {
    try {
      if (callServer) await api('/auth/logout', { method: 'POST' });
    } catch {
      // El cierre local procede aunque la red falle.
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession]);

  useEffect(() => {
    let mounted = true;
    setOnSessionExpired(() => {
      if (mounted) void clearLocalSession();
    });

    (async () => {
      try {
        const tokens = await loadTokens();
        if (!tokens) return;
        setTokens(tokens);
        const me = await api('/auth/me');
        if (mounted) setSession(me);
      } catch {
        if (mounted) await clearLocalSession();
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clearLocalSession]);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setTokens({ access: data.accessToken, refresh: data.refreshToken });
    await saveTokens({ access: data.accessToken, refresh: data.refreshToken });
    try {
      const me = await api('/auth/me');
      setSession(me);
      return me;
    } catch (error) {
      await clearLocalSession();
      throw error;
    }
  }, [clearLocalSession]);

  const can = useCallback(
    (permission) => Boolean(session?.role?.permissions?.includes(permission)),
    [session]
  );

  const value = useMemo(
    () => ({ session, initializing, login, logout, can }),
    [session, initializing, login, logout, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
