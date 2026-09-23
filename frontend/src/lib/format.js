/**
 * Formateadores compartidos por todas las pantallas (FASE 7).
 * Sin dependencias: React Native / RN Web / Node comparten este módulo.
 */

/**
 * Importe como moneda: "$1,234.56" (2 decimales, millares con coma).
 * Acepta number|string|null|undefined → siempre devuelve texto.
 */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  return `${sign}$${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/**
 * Fecha legible en español: "21/09/2026" y, si withTime, "21/09/2026 14:05".
 * - Los strings "AAAA-MM-DD" se interpretan como fecha LOCAL (sin corrimiento
 *   por zona horaria que deja el Date nativo de ISO sin hora).
 * - Nulo / inválido → "—".
 */
export function dateOf(value, withTime = false) {
  if (!value) return '—';
  let d;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const fecha = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!withTime) return fecha;
  return `${fecha} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Invierte las opciones de un select: [{value,label}] → {value: label}.
 * Se usa con labelFor() para mostrar nombres en listas y detalles.
 */
export function invert(options) {
  const map = {};
  for (const o of options || []) {
    if (o && o.value !== null && o.value !== undefined && o.value !== '') {
      map[String(o.value)] = o.label;
    }
  }
  return map;
}

/**
 * Etiqueta de un valor referenciado (id u objeto poblado).
 *  - id en el mapa → su nombre;
 *  - objeto poblado (populate) → name/code/sku/email;
 *  - sin resolver (cargando o borrado) → "—".
 */
export function labelFor(value, map = {}) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    const key = value._id !== undefined && value._id !== null ? String(value._id) : '';
    if (key && map[key]) return map[key];
    return value.name || value.code || value.sku || value.email || value.documentId || '—';
  }
  const key = String(value);
  return map[key] || '—';
}
