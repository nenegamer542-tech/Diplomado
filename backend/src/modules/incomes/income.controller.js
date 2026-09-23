'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const incomeService = require('./income.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.accountId) extra.accountId = req.query.accountId;
  if (req.query.customerId) extra.customerId = req.query.customerId;
  if (req.query.category) extra.category = req.query.category;
  const dateFilter = {};
  if (req.query.from) dateFilter.$gte = req.query.from;
  if (req.query.to) dateFilter.$lte = req.query.to;
  if (Object.keys(dateFilter).length) extra.date = dateFilter;
  Object.assign(extra, searchFilterMulti(['code', 'category', 'description'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await incomeService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const income = await incomeService.getById(req.params.id, req.user.companyId);
  if (!income) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, income);
});

const create = asyncHandler(async (req, res) => {
  const income = await incomeService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = income._id;
  return created(res, income);
});

const voidRegister = asyncHandler(async (req, res) => {
  const before = await incomeService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await incomeService.void(req.params.id, req.body, req.user.companyId, req.user.id);
  return ok(res, after);
});

module.exports = { list, getById, create, void: voidRegister };
