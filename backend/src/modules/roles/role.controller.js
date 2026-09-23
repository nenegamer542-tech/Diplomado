'use strict';

const roleService = require('./role.service');
const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { assertOwnership } = require('../../middlewares/tenant');
const { ALL_PERMISSIONS } = require('../../config/permissions');
const { searchFilterMulti } = require('../../utils/search');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = searchFilterMulti(['code', 'label'], req.query.search);
  if (req.query.status) extra.status = req.query.status;

  let filter;
  if (req.user.companyId) {
    // Miembro de empresa: SÓLO sus roles (nunca cruza tenants).
    filter = { companyId: req.user.companyId, ...extra };
  } else if (req.user.isPlatformAdmin) {
    // Super Admin: roles de plataforma, o los de una empresa con ?companyId=.
    filter = { companyId: req.query.companyId || null, ...extra };
  } else {
    throw ApiError.forbidden('Operación no disponible fuera del contexto de una empresa.');
  }

  const { items, total } = await roleService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

/** Catálogo de permisos en código — para el editor de roles del frontend. */
const permissionCatalog = asyncHandler(async (req, res) =>
  ok(res, { permissions: [...ALL_PERMISSIONS] })
);

const getById = asyncHandler(async (req, res) => {
  const doc = await roleService.getById(req.params.id);
  assertOwnership(req, doc);
  if (!doc) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, doc);
});

const create = asyncHandler(async (req, res) => {
  const doc = await roleService.create(req.body, req.user);
  return created(res, doc);
});

const update = asyncHandler(async (req, res) => {
  const before = await roleService.getById(req.params.id);
  assertOwnership(req, before);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await roleService.update(req.params.id, req.body, req.user);
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await roleService.getById(req.params.id);
  assertOwnership(req, before);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await roleService.remove(req.params.id, req.user);
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, permissionCatalog, getById, create, update, remove };
