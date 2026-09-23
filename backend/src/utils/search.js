'use strict';

/**
 * Búsquedas de usuario → filtros Mongo seguros.
 * Siempre se escapa la entrada: nunca se concatena texto crudo en una regex
 * (previene errores de sintaxis y patrones maliciosos).
 */

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Filtro de búsqueda para UN campo. Devuelve {} si no hay término. */
function searchFilter(field, term) {
  if (!term) return {};
  return { [field]: { $regex: escapeRegex(term), $options: 'i' } };
}

/** Filtro de búsqueda OR sobre varios campos. Devuelve {} si no hay término. */
function searchFilterMulti(fields, term) {
  if (!term) return {};
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  return { $or: fields.map((f) => ({ [f]: rx })) };
}

module.exports = { escapeRegex, searchFilter, searchFilterMulti };
