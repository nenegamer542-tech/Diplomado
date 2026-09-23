'use strict';

const { Router } = require('express');
const controller = require('./role.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const schemas = require('./role.validation');

const router = Router();

/**
 * Roles y permisos.
 *
 * GET    /api/v1/roles/permissions — catálogo de permisos (roles.read)
 * GET    /api/v1/roles              — listado (roles.read)
 * POST   /api/v1/roles              — crear rol propio (roles.create)
 * GET    /api/v1/roles/:id          — detalle (roles.read)
 * PATCH  /api/v1/roles/:id          — editar (roles.update; bloqueado si isSystem)
 * DELETE /api/v1/roles/:id          — eliminar (roles.delete; bloqueado si isSystem o en uso)
 *
 * /permissions se registra ANTES de /:id para no capturarlo.
 */

router.get('/', authenticate, authorize('roles.read'), validate({ query: schemas.listQuery }), controller.list);

router.get('/permissions', authenticate, authorize('roles.read'), controller.permissionCatalog);

router.get(
  '/:id',
  authenticate,
  authorize('roles.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.post(
  '/',
  authenticate,
  authorize('roles.create'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.patch(
  '/:id',
  authenticate,
  authorize('roles.update'),
  preventUnknownFields(schemas.CREATE_FIELDS),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  authorize('roles.delete'),
  validate({ params: schemas.idParams }),
  controller.remove
);

module.exports = router;
