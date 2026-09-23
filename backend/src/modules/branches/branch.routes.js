'use strict';

const { Router } = require('express');
const controller = require('./branch.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const schemas = require('./branch.validation');

const router = Router();

/**
 * Sucursales — SIEMPRE en contexto de empresa (requireTenant).
 *
 * GET    /api/v1/branches      — listado (branches.read)
 * POST   /api/v1/branches      — crear (branches.create)
 * GET    /api/v1/branches/:id  — detalle (branches.read)
 * PATCH  /api/v1/branches/:id  — editar (branches.update)
 * DELETE /api/v1/branches/:id  — eliminar (branches.delete; borrado físico con guardas)
 */

router.get(
  '/',
  authenticate,
  requireTenant,
  authorize('branches.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

router.post(
  '/',
  authenticate,
  requireTenant,
  authorize('branches.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.get(
  '/:id',
  authenticate,
  requireTenant,
  authorize('branches.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.patch(
  '/:id',
  authenticate,
  requireTenant,
  authorize('branches.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  requireTenant,
  authorize('branches.delete'),
  validate({ params: schemas.idParams }),
  controller.remove
);

module.exports = router;
