'use strict';

const userService = require('./user.service');
const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { tenantFilter, assertOwnership } = require('../../middlewares/tenant');
const { searchFilterMulti } = require('../../utils/search');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = searchFilterMulti(['name', 'lastName', 'email'], req.query.search);
  if (req.query.status) extra.status = req.query.status;
  if (req.query.roleId) extra.roleId = req.query.roleId;
  if (req.query.branchId) extra.branchId = req.query.branchId;

  // companyId SIEMPRE del token. Sólo Super Admin + ?allCompanies=true lista global.
  const filter = tenantFilter(req, extra);

  const { items, total } = await userService.list(filter, { sort, skip, limit }, req.user);
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const doc = await userService.getById(req.params.id, req.user);
  assertOwnership(req, doc);
  if (!doc) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, doc);
});

const create = asyncHandler(async (req, res) => {
  const doc = await userService.create(req.body, req.user);
  return created(res, doc);
});

const update = asyncHandler(async (req, res) => {
  const before = await userService.getById(req.params.id, req.user);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before; // snapshot para el audit middleware

  const after = await userService.update(req.params.id, req.body, req.user);
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await userService.getById(req.params.id, req.user);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await userService.remove(req.params.id, req.user);
  return ok(res, { _id: after._id, status: after.status });
});

module.exports = { list, getById, create, update, remove };
