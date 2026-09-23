'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./expense.controller');
const schemas = require('./expense.validation');

const router = Router();

// Gastos APPEND-ONLY: sin PUT/PATCH/DELETE; sólo void (ADR-011).

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.expenses.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('finance.expenses.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.expenses.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.post(
  '/:id/void',
  authenticate,
  requireTenant,
  authorize('finance.expenses.void'),
  preventUnknownFields(schemas.VOID_FIELDS),
  validate({ params: schemas.idParams, body: schemas.voidSchema }),
  controller.void
);

module.exports = router;
