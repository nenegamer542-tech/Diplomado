'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./income.controller');
const schemas = require('./income.validation');

const router = Router();

// Ingresos APPEND-ONLY: sin PUT/PATCH/DELETE; sólo void (ADR-011).

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.income.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('finance.income.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.income.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.post(
  '/:id/void',
  authenticate,
  requireTenant,
  authorize('finance.income.void'),
  preventUnknownFields(schemas.VOID_FIELDS),
  validate({ params: schemas.idParams, body: schemas.voidSchema }),
  controller.void
);

module.exports = router;
