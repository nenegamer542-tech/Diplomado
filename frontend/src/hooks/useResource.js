import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Hooks de datos para las pantallas FASE 7.
 *  - useList(path, query): listado paginado del backend (data + meta.total).
 *  - usePicklist(path): opciones para los <select> (hasta 100 registros).
 */

const LIMIT = 20;

export function useList(path, query = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(path, {
      query: { page, limit: LIMIT, search: search || undefined, ...query },
      withMeta: true,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res.data) ? res.data : []);
        setTotal(res.meta?.total ?? 0);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // query se serializa para no re-petir el request en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, search, queryKey, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    items,
    total,
    page,
    limit: LIMIT,
    loading,
    error,
    search,
    setSearch: (s) => {
      setSearch(s);
      setPage(1);
    },
    setPage,
    reload,
  };
}

const defaultLabel = (r) => r.name || r.sku || r.code || r.email || r.documentId || String(r._id);

/** Catálogo para selects: se carga una vez por recurso. */
export function usePicklist(path, labelOf = defaultLabel) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const labelRef = useRef(labelOf);
  labelRef.current = labelOf;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(path, { query: { limit: 100 } })
      .then((rows) => {
        if (cancelled) return;
        setOptions(
          (Array.isArray(rows) ? rows : []).map((r) => ({
            value: String(r._id),
            label: labelRef.current(r),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { options, loading };
}
