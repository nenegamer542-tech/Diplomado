'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { searchFilterMulti } = require('../../utils/search');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const leadService = require('./lead.service');

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.status) extra.status = req.query.status;
  if (req.query.source) extra.source = req.query.source;
  if (req.query.assignedTo) extra.assignedTo = req.query.assignedTo;
  Object.assign(extra, searchFilterMulti(['name', 'company', 'email', 'phone'], req.query.search));

  const filter = tenantFilter(req, extra);
  const { items, total } = await leadService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getById = asyncHandler(async (req, res) => {
  const lead = await leadService.getById(req.params.id, req.user.companyId);
  if (!lead) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, lead);
});

const create = asyncHandler(async (req, res) => {
  const lead = await leadService.create(req.body, req.user.companyId, req.user.id);
  req.auditResourceId = lead._id;
  return created(res, lead);
});

const update = asyncHandler(async (req, res) => {
  const before = await leadService.getById(req.params.id, req.user.companyId);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await leadService.update(req.params.id, req.body, req.user.companyId);
  if (!after) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, after);
});

module.exports = { list, getById, create, update };
