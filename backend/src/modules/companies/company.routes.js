'use strict';

const { Router } = require('express');
const controller = require('./company.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, platformOnly, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const schemas = require('./company.validation');

const router = Router();

/**
 * POST   /api/v1/companies        — crear empresa (solo plataforma; aprovisiona sucursal + roles)
 * GET    /api/v1/companies        — listar todas (solo plataforma)
 * GET    /api/v1/companies/me     — empresa del usuario autenticado (cualquier miembro)
 * GET    /api/v1/companies/:id    — detalle (plataforma o miembro de esa empresa)
 * PATCH  /api/v1/companies/:id    — actualizar (plataforma o administrador de la empresa)
 * DELETE /api/v1/companies/:id    — suspender (solo plataforma; borrado lógico)
 *
 * NOTA: /me va antes de /:id para que Express no lo capture como ":id".
 */

router.post(
  '/',
  authenticate,
  platformOnly,
  authorize('companies.create'),
  validate({ body: schemas.createSchema }),
  controller.create
);

router.get(
  '/',
  authenticate,
  platformOnly,
  authorize('companies.read'),
  validate({ query: schemas.listQuery }),
  controller.list
);

// Cualquier miembro puede leer SU empresa (no requiere companies.read explícito).
router.get('/me', authenticate, requireTenant, controller.getMe);

router.get(
  '/:id',
  authenticate,
  authorize('companies.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.patch(
  '/:id',
  authenticate,
  authorize('companies.update'),
  validate({ params: schemas.idParams, body: schemas.updateSchema }),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  platformOnly,
  authorize('companies.delete'),
  validate({ params: schemas.idParams }),
  controller.remove
);

module.exports = router;
