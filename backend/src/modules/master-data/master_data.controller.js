'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const service = require('./master_data.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const filter = { ...searchFilterMulti(['code', 'name', 'description'], req.query.search) };
  if (req.query.status) filter.status = req.query.status;
  const scopedFilter = tenantFilter(req, filter);
  const { items, total } = await service.list(req.params.type, scopedFilter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const item = await service.getById(req.params.type, req.params.id, req.user.companyId);
  if (!item) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, item);
});

const create = asyncHandler(async (req, res) => {
  return created(res, await service.create(req.params.type, req.body, req.user.companyId));
});

const update = asyncHandler(async (req, res) => {
  const before = await service.getById(req.params.type, req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;
  const after = await service.update(req.params.type, req.params.id, req.body, req.user.companyId);
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await service.getById(req.params.type, req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;
  const after = await service.remove(req.params.type, req.params.id, req.user.companyId);
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, getById, create, update, remove };
