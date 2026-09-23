'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./employee.controller');
const schemas = require('./employee.validation');

const router = Router();

// Empleados sin DELETE: la baja es status inactive (ADR-012).

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('hr.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('hr.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('hr.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('hr.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

module.exports = router;
