'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const employeeService = require('./employee.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.department) extra.department = req.query.department;
  Object.assign(
    extra,
    searchFilterMulti(['documentId', 'firstName', 'lastName', 'email', 'position'], req.query.search)
  );

  const filter = tenantFilter(req, extra);
  const { items, total } = await employeeService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const employee = await employeeService.getById(req.params.id, req.user.companyId);
  if (!employee) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, employee);
});

const create = asyncHandler(async (req, res) => {
  const employee = await employeeService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = employee._id;
  return created(res, employee);
});

const update = asyncHandler(async (req, res) => {
  const before = await employeeService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await employeeService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

module.exports = { list, getById, create, update };
