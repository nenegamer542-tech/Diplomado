'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const service = require('./inventory_count.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
  const { items, total } = await service.list(tenantFilter(req, extra), { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const count = await service.getById(req.params.id, req.user.companyId);
  if (!count) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, count);
});

const create = asyncHandler(async (req, res) => {
  const count = await service.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = count._id;
  return created(res, count);
});

const post = asyncHandler(async (req, res) => {
  const before = await service.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;
  const count = await service.post(req.params.id, req.user.companyId, req.user.id);
  req.auditResourceId = count._id;
  return ok(res, count);
});

module.exports = { list, getById, create, post };
