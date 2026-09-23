'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./lead.controller');
const schemas = require('./lead.validation');

const router = Router();

// Leads sin DELETE: la baja es un cambio de estado del ciclo de vida (ADR-012).

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('crm.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('crm.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('crm.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('crm.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

module.exports = router;
