'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const accountService = require('./account.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.type) extra.type = req.query.type;
  Object.assign(extra, searchFilterMulti(['code', 'name'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await accountService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const account = await accountService.getById(req.params.id, req.user.companyId);
  if (!account) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, account);
});

const create = asyncHandler(async (req, res) => {
  const account = await accountService.create(req.body, req.user.companyId);
  req.auditResourceId = account._id;
  return created(res, account);
});

const update = asyncHandler(async (req, res) => {
  const before = await accountService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await accountService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await accountService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await accountService.remove(req.params.id, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, { _id: after._id, deleted: true });
});

module.exports = { list, getById, create, update, remove };
