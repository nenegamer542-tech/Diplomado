/**
 * Cliente HTTP mínimo para la API del ERP (sin dependencias extra).
 *
 * - URL base: variable de entorno EXPO_PUBLIC_API_URL (ver .env.example).
 * - Adjunta el access token automáticamente.
 * - `withMeta: true` devuelve { data, meta } (los listados paginan con meta.total).
 * - apiText() descarga respuesta en texto (exportación CSV de reportes).
 * - Ante un 401 TOKEN_EXPIRED intenta UNA renovación con el refresh token
 *   (promesa única: si varios requests fallan a la vez, sólo se refresca una vez).
 * - Si el refresh falla, invoca onSessionExpired (AuthContext cierra la sesión).
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let accessToken = null;
let refreshToken = null;
let onSessionExpired = null;
let refreshPromise = null;

export function setTokens({ access = null, refresh = null } = {}) {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnSessionExpired(fn) {
  onSessionExpired = fn;
}

async function tryRefresh() {
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      setTokens({ access: body.data.accessToken, refresh: body.data.refreshToken });
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * petición('/users', { method, body, query })
 * @returns data (ya desempaquetada) o lanza Error con .status y .code
 */
export async function api(path, { method = 'GET', body, query, auth = true, withMeta = false } = {}) {
  // Construcción manual de la query: URL/searchParams no está garantizado en RN/Hermes.
  const params = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const url = `${BASE_URL}${path}${params ? `?${params}` : ''}`;

  const doFetch = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // Renovación transparente una sola vez.
  if (res.status === 401 && auth && (await safeRefresh())) {
    res = await doFetch();
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok) {
    if (res.status === 401 && auth && onSessionExpired) onSessionExpired();
    const error = new Error(payload?.error?.message || 'Error de red. Intente de nuevo.');
    error.status = res.status;
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;
    throw error;
  }

  if (withMeta) {
    return { data: payload?.data, meta: payload?.meta };
  }
  return payload?.data;
}

/** GET en texto plano (reportes CSV). Misma renovación de token que api(). */
export async function apiText(path, { auth = true } = {}) {
  const url = `${BASE_URL}${path}`;
  const doFetch = () => {
    const headers = {};
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(url, { headers });
  };

  let res = await doFetch();
  if (res.status === 401 && auth && (await safeRefresh())) {
    res = await doFetch();
  }
  if (!res.ok) {
    if (res.status === 401 && auth && onSessionExpired) onSessionExpired();
    const error = new Error('No se pudo descargar el reporte.');
    error.status = res.status;
    throw error;
  }
  return res.text();
}

async function safeRefresh() {
  try {
    return await tryRefresh();
  } catch {
    return false;
  }
}
