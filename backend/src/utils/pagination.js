'use strict';

/**
 * Paginación consistente: ?page=1&limit=20  (limit máximo 100)
 */
const MAX_LIMIT = 100;

function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  // `|| 20` trataría limit='0' como ausente (0 es falsy): se separa NaN del resto.
  const parsedLimit = parseInt(query.limit, 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isNaN(parsedLimit) ? 20 : parsedLimit));
  const skip = (page - 1) * limit;

  const sort = {};
  if (query.sortBy) {
    const dir = query.sortDir === 'desc' ? -1 : 1;
    // Whitelist implícito: solo campos alfanuméricos/underscore.
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(query.sortBy)) sort[query.sortBy] = dir;
  }
  if (Object.keys(sort).length === 0) sort.createdAt = -1;

  return { page, limit, skip, sort };
}

function buildMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = { parsePagination, buildMeta, MAX_LIMIT };
