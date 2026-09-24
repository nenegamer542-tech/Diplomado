'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const productionOrderService = require('./production_order.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.bomId) extra.bomId = req.query.bomId;
  if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
  if (req.query.productId) extra.productId = req.query.productId;
  Object.assign(extra, searchFilterMulti(['code', 'notes'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await productionOrderService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const order = await productionOrderService.getById(req.params.id, req.user.companyId);
  if (!order) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, order);
});

const create = asyncHandler(async (req, res) => {
  const order = await productionOrderService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = order._id;
  return created(res, order);
});

const update = asyncHandler(async (req, res) => {
  const before = await productionOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await productionOrderService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

const release = asyncHandler(async (req, res) => {
  const before = await productionOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await productionOrderService.release(req.params.id, req.user.companyId, req.user.id, req.body);
  return ok(res, after);
});

const done = asyncHandler(async (req, res) => {
  const before = await productionOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await productionOrderService.done(req.params.id, req.user.companyId, req.user.id, req.body);
  return ok(res, after);
});

const cancel = asyncHandler(async (req, res) => {
  const before = await productionOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await productionOrderService.cancel(
    req.params.id,
    req.body,
    req.user.companyId,
    req.user.id
  );
  return ok(res, after);
});

module.exports = { list, getById, create, update, release, done, cancel };
