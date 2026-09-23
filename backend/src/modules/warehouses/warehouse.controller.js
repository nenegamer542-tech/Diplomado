'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const warehouseService = require('./warehouse.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  Object.assign(extra, searchFilterMulti(['code', 'name'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await warehouseService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const warehouse = await warehouseService.getById(req.params.id, req.user.companyId);
  if (!warehouse) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, warehouse);
});

const create = asyncHandler(async (req, res) => {
  const warehouse = await warehouseService.create(req.body, req.user.companyId);
  return created(res, warehouse);
});

const update = asyncHandler(async (req, res) => {
  const before = await warehouseService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await warehouseService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await warehouseService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await warehouseService.remove(req.params.id, req.user.companyId);
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, getById, create, update, remove };
