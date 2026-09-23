'use strict';

const auditService = require('./audit.service');
const { ok } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { tenantFilter, assertOwnership } = require('../../middlewares/tenant');

/**
 * Auditoría: SOLO LECTURA.
 * No existe POST/PUT/DELETE: la bitácora es inmutable vía API (requisito §20).
 */

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.module) extra.module = String(req.query.module);
  if (req.query.action) extra.action = String(req.query.action);
  if (req.query.userId) extra.userId = req.query.userId;
  if (req.query.result) extra.result = String(req.query.result);
  if (req.query.from || req.query.to) {
    extra.createdAt = {};
    if (req.query.from) extra.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) extra.createdAt.$lte = new Date(req.query.to);
  }

  const filter = tenantFilter(req, extra);
  // Super Admin sin tenant: sólo la auditoría de PLATAFORMA (companyId null).
  if (!('companyId' in filter)) filter.companyId = null;

  const { items, total } = await auditService.list(filter, { sort, skip, limit });

  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const doc = await auditService.findById(req.params.id, req.user.companyId);
  assertOwnership(req, doc);
  if (!doc) throw ApiError.notFound('Registro de auditoría no encontrado.');
  return ok(res, doc);
});

module.exports = { list, getById };
