'use strict';

const { ok, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { tenantFilter } = require('../../middlewares/tenant');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const inventoryService = require('./inventory.service');

/** actor: companyId SIEMPRE del token, userId para trazabilidad del movimiento. */
const actorOf = (req) => ({ companyId: req.user.companyId, userId: req.user.id });

const listStock = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
  if (req.query.productId) extra.productId = req.query.productId;

  const filter = tenantFilter(req, extra);
  const { items, total } = await inventoryService.listStock(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const listAlerts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { items, total } = await inventoryService.listAlerts(req.user.companyId, { skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const listMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);

  const extra = {};
  if (req.query.type) extra.type = req.query.type;
  if (req.query.productId) extra.productId = req.query.productId;
  if (req.query.warehouseId) extra.warehouseId = req.query.warehouseId;
  if (req.query.from || req.query.to) {
    const createdAt = {};
    if (req.query.from) createdAt.$gte = new Date(req.query.from);
    if (req.query.to) createdAt.$lte = new Date(req.query.to);
    extra.createdAt = createdAt;
  }

  const filter = tenantFilter(req, extra);
  const { items, total } = await inventoryService.listMovements(filter, { sort, skip, limit });
  return ok(res, items, buildMeta(page, limit, total));
});

const getMovement = asyncHandler(async (req, res) => {
  const movement = await inventoryService.getMovement(req.params.id, req.user.companyId);
  if (!movement) throw ApiError.notFound('Recurso no encontrado.');
  return ok(res, movement);
});

const createEntry = asyncHandler(async (req, res) => {
  const movement = await inventoryService.entry(req.body, actorOf(req));
  req.auditResourceId = String(movement._id);
  return created(res, movement);
});

const createExit = asyncHandler(async (req, res) => {
  const movement = await inventoryService.exit(req.body, actorOf(req));
  req.auditResourceId = String(movement._id);
  return created(res, movement);
});

const createAdjustment = asyncHandler(async (req, res) => {
  const movement = await inventoryService.adjustment(req.body, actorOf(req));
  req.auditResourceId = String(movement._id);
  return created(res, movement);
});

const createTransfer = asyncHandler(async (req, res) => {
  const movement = await inventoryService.transfer(req.body, actorOf(req));
  req.auditResourceId = String(movement._id);
  return created(res, movement);
});

module.exports = {
  listStock,
  listAlerts,
  listMovements,
  getMovement,
  createEntry,
  createExit,
  createAdjustment,
  createTransfer,
};
