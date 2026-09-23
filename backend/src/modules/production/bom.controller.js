'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const bomService = require('./bom.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.productId) extra.productId = req.query.productId;
  Object.assign(extra, searchFilterMulti(['code', 'notes'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await bomService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const bom = await bomService.getById(req.params.id, req.user.companyId);
  if (!bom) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, bom);
});

const create = asyncHandler(async (req, res) => {
  const bom = await bomService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = bom._id;
  return created(res, bom);
});

const update = asyncHandler(async (req, res) => {
  const before = await bomService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await bomService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

module.exports = { list, getById, create, update };
