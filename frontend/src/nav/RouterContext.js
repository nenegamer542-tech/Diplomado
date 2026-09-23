import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Router mínimo SIN dependencias (React Navigation no es necesario para FASE 7):
 * pila de rutas en estado, apto para web y móvil con los mismos componentes.
 *  - navigate(name, params): empuja (botón "atrás" disponible).
 *  - go(name, params): reemplaza la pila (menú lateral: evita apilar clics).
 *  - back(): regresa un nivel.
 */
const RouterContext = createContext(null);

export function RouterProvider({ children }) {
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);

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
