'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./purchase_order.controller');
const schemas = require('./purchase_order.validation');

const router = Router();

// Consulta
router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('purchases.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('purchases.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

// Borrador
router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('purchases.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('purchases.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

// Flujo (aprobar = entrada de inventario; rechazar no toca stock)
router.post(
  '/:id/approve',
  authenticate,
  requireTenant,
  authorize('purchases.approve'),
  preventUnknownFields(schemas.APPROVE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.approveSchema }),
  controller.approve
);

router.post(
  '/:id/reject',
  authenticate,
  requireTenant,
  authorize('purchases.approve'),
  preventUnknownFields(schemas.REJECT_FIELDS),
  validate({ params: schemas.idParams, body: schemas.rejectSchema }),
  controller.reject
);

module.exports = router;
