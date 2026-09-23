import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setTokens, setOnSessionExpired } from '../api/client';

/**
 * Sesión de la aplicación.
 * - login(email, password) → llama a /auth/login y guarda los tokens.
 * - logout() → /auth/logout (invalidación global en servidor) y limpia.
 * - session: salida de /auth/me ({ user, role, company, branch }).
 * TODO FASE 3: persistir tokens con AsyncStorage (hoy: memoria, se pierde al recargar).
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(async ({ callServer = true } = {}) => {
    try {
      if (callServer) await api('/auth/logout', { method: 'POST' });
    } catch {
      /* el logout local procede aunque la red falle */
    }
    setTokens({ access: null, refresh: null });
    setSession(null);
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => {
      // Refresh inválido/expirado: la sesión ya no es válida.
      setTokens({ access: null, refresh: null });
      setSession(null);
    });
    setInitializing(false);
    // TODO: si hay tokens guardados → /auth/me para restaurar la sesión.
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setTokens({ access: data.accessToken, refresh: data.refreshToken });
    const me = await api('/auth/me');
    setSession(me);
    return me;
  }, []);

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
