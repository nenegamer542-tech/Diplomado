'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const budgetService = require('./budget.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.year) extra.year = req.query.year;
  if (req.query.month) extra.month = req.query.month;
  if (req.query.category) extra.category = req.query.category;
  Object.assign(extra, searchFilterMulti(['category'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await budgetService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const budget = await budgetService.getById(req.params.id, req.user.companyId);
  if (!budget) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, budget);
});

const create = asyncHandler(async (req, res) => {
  const budget = await budgetService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = budget._id;
  return created(res, budget);
});

const update = asyncHandler(async (req, res) => {
  const before = await budgetService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await budgetService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await budgetService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await budgetService.remove(req.params.id, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, getById, create, update, remove };
