'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./account.controller');
const schemas = require('./account.validation');

const router = Router();

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.accounts.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('finance.accounts.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('finance.accounts.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('finance.accounts.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  requireTenant,
  authorize('finance.accounts.delete'),
  validate({ params: schemas.idParams }),
  controller.remove
);

module.exports = router;
