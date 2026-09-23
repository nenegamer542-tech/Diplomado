'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const salesOrderService = require('./sales_order.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.customerId) extra.customerId = req.query.customerId;
  Object.assign(extra, searchFilterMulti(['code'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await salesOrderService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const order = await salesOrderService.getById(req.params.id, req.user.companyId);
  if (!order) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, order);
});

const create = asyncHandler(async (req, res) => {
  const order = await salesOrderService.create(req.body, req.user.companyId, req.user.id);
  return created(res, order);
});

const update = asyncHandler(async (req, res) => {
  const before = await salesOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await salesOrderService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

const approve = asyncHandler(async (req, res) => {
  const before = await salesOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await salesOrderService.approve(req.params.id, req.user.companyId, req.user.id);
  return ok(res, after);
});

const reject = asyncHandler(async (req, res) => {
  const before = await salesOrderService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await salesOrderService.reject(
    req.params.id,
    req.body,
    req.user.companyId,
    req.user.id
  );
  return ok(res, after);
});

module.exports = { list, getById, create, update, approve, reject };
