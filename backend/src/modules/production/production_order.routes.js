'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./production_order.controller');
const schemas = require('./production_order.validation');

const router = Router();

// OT sin DELETE: DRAFT → RELEASED → DONE | CANCELLED (ADR-012/013).

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('production.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('production.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

// Borrador
router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('production.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('production.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

// Flujo (release = salidas de componentes; done = entrada de producto terminado)
router.post(
  '/:id/release',
  authenticate,
  requireTenant,
  authorize('production.update'),
  preventUnknownFields([]),
  validate({ params: schemas.idParams, body: schemas.emptyBody }),
  controller.release
);

router.post(
  '/:id/done',
  authenticate,
  requireTenant,
  authorize('production.update'),
  preventUnknownFields([]),
  validate({ params: schemas.idParams, body: schemas.emptyBody }),
  controller.done
);

router.post(
  '/:id/cancel',
  authenticate,
  requireTenant,
  authorize('production.update'),
  preventUnknownFields(schemas.CANCEL_FIELDS),
  validate({ params: schemas.idParams, body: schemas.cancelSchema }),
  controller.cancel
);

module.exports = router;
