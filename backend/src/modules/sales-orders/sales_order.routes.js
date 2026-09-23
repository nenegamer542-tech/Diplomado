'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./sales_order.controller');
const schemas = require('./sales_order.validation');

const router = Router();

// Consulta
router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('sales.orders.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('sales.orders.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

// Borrador
router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('sales.orders.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('sales.orders.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

// Flujo (aprobar = salida de inventario con stock validado; rechazar no toca stock)
router.post(
  '/:id/approve',
  authenticate,
  requireTenant,
  authorize('sales.orders.approve'),
  preventUnknownFields(schemas.APPROVE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.approveSchema }),
  controller.approve
);

router.post(
  '/:id/reject',
  authenticate,
  requireTenant,
  authorize('sales.orders.approve'),
  preventUnknownFields(schemas.REJECT_FIELDS),
  validate({ params: schemas.idParams, body: schemas.rejectSchema }),
  controller.reject
);

module.exports = router;
