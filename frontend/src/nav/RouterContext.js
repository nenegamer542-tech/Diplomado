import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Router mínimo con persistencia de ruta activa para Web (hash) y Móvil (storage).
 * Preserva la pantalla exacta al recargar la página (F5) o reabrir la aplicación.
 */
const RouterContext = createContext(null);

function getInitialRoute() {
  try {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash) {
        return { name: hash, params: {} };
      }
      const saved = window.localStorage.getItem('tectode_erp_last_route');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { name: 'home', params: {} };
}

export function RouterProvider({ children }) {
  const [stack, setStack] = useState(() => [getInitialRoute()]);

  const navigate = useCallback((name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
  }, []);

  const go = useCallback((name, params = {}) => {
    setStack([{ name: 'home', params: {} }, { name, params }]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const route = stack[stack.length - 1];

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && route?.name) {
        window.location.hash = `#/${route.name}`;
        window.localStorage.setItem('tectode_erp_last_route', JSON.stringify(route));
      }
    } catch {
      /* ignore */
    }
  }, [route]);

  const value = useMemo(
    () => ({ route, navigate, go, back, canGoBack: stack.length > 1 }),
    [route, navigate, go, back, stack.length]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useNav() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useNav debe usarse dentro de <RouterProvider>');
  return ctx;
}
