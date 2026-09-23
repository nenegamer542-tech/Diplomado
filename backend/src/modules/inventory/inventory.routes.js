'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./inventory.controller');
const schemas = require('./inventory.validation');

const router = Router();

// --- Consulta (sólo lectura) ---
router.get(
  '/stock',
  authenticate,
  requireTenant,
  authorize('inventory.read'),
  validate({ query: schemas.stockQuery }),
  controller.listStock
);

router.get(
  '/movements',
  authenticate,
  requireTenant,
  authorize('inventory.read'),
  validate({ query: schemas.movementsQuery }),
  controller.listMovements
);

router.get(
  '/movements/:id',
  authenticate,
  requireTenant,
  authorize('inventory.read'),
  validate({ params: schemas.idParams }),
  controller.getMovement
);

// --- Movimientos (creación única; sin PATCH/DELETE: histórico inmutable) ---
router.post(
  '/entries',
  authenticate,
  requireTenant,
  authorize('inventory.movements.create'),
  preventUnknownFields(schemas.ENTRY_EXIT_FIELDS),
  validate({ body: schemas.entrySchema }),
  controller.createEntry
);

router.post(
  '/exits',
  authenticate,
  requireTenant,
  authorize('inventory.movements.create'),
  preventUnknownFields(schemas.ENTRY_EXIT_FIELDS),
  validate({ body: schemas.exitSchema }),
  controller.createExit
);

router.post(
  '/adjustments',
  authenticate,
  requireTenant,
  authorize('inventory.adjustments.create'),
  preventUnknownFields(schemas.ADJUSTMENT_FIELDS),
  validate({ body: schemas.adjustmentSchema }),
  controller.createAdjustment
);

router.post(
  '/transfers',
  authenticate,
  requireTenant,
  authorize('inventory.transfers.create'),
  preventUnknownFields(schemas.TRANSFER_FIELDS),
  validate({ body: schemas.transferSchema }),
  controller.createTransfer
);

module.exports = router;
