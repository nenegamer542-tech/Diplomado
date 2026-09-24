'use strict';

const companyService = require('./company.service');
const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { searchFilter } = require('../../utils/search');

/**
 * Controlador de empresas. Sin lógica de negocio: sólo orquesta
 * validación (middleware), service y formato de respuesta.
 */

const list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const filter = searchFilter('name', req.query.search);
  if (req.query.status) filter.status = req.query.status;

  const { items, total } = await companyService.list(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

/** Empresa del usuario autenticado (para el header del frontend). */
const getMe = asyncHandler(async (req, res) => {
  const doc = await companyService.getOwn(req.user.companyId);
  if (!doc) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, doc);
});

const getSettings = asyncHandler(async (req, res) => {
  return ok(res, await companyService.getSettings(req.user.companyId));
});

const updateSettings = asyncHandler(async (req, res) => {
  const before = await companyService.getSettings(req.user.companyId);
  req.auditBefore = before;
  req.auditResourceId = req.user.companyId;
  const settings = await companyService.updateSettings(req.user.companyId, req.body);
  return ok(res, settings);
});

const getById = asyncHandler(async (req, res) => {
  const doc = await companyService.getById(req.params.id, req.user);
  if (!doc) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, doc);
});

const create = asyncHandler(async (req, res) => {
  const data = await companyService.create(req.body);
  return created(res, data);
});

const update = asyncHandler(async (req, res) => {
  // Snapshot previo para auditoría (lo lee el audit middleware al responder).
  const before = await companyService.getById(req.params.id, req.user);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await companyService.update(req.params.id, req.body, req.user);
  return ok(res, after);
});

const remove = asyncHandler(async (req, res) => {
  const before = await companyService.getById(req.params.id, req.user);
  if (!before) throw ApiError.notFound('Recurso no encontrado.');
  req.auditBefore = before;

  const after = await companyService.remove(req.params.id, req.user);
  return ok(res, after);
});

module.exports = { list, getMe, getSettings, updateSettings, getById, create, update, remove };
