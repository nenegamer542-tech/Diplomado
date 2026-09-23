'use strict';

const branchService = require('./branch.service');
const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { tenantFilter } = require('../../middlewares/tenant');
const { searchFilterMulti } = require('../../utils/search');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = searchFilterMulti(['code', 'name'], req.query.search);
  if (req.query.status) extra.status = req.query.status;

  // Garantiza companyId desde el token (requireTenant ya lo exigió en ruta).
  const filter = tenantFilter(req, extra);

  const { items, total } = await branchService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const doc = await branchService.getById(req.params.id, req.user.companyId);
  if (!doc) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, doc);
});

const create = asyncHandler(async (req, res) => {
  const doc = await branchService.create(req.body, req.user.companyId);
  return created(res, doc);
});

const update = asyncHandler(async (req, res) => {
  const before = await branchService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before; // snapshot para el audit middleware

  const after = await branchService.update(req.params.id, req.body, req.user.companyId);
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await branchService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await branchService.remove(req.params.id, req.user.companyId);
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, getById, create, update, remove };
