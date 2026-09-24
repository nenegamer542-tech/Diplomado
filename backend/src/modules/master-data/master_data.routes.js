'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const controller = require('./master_data.controller');
const schemas = require('./master_data.validation');

const router = Router();
const validateBodyByType = (schemaMap) => (req, res, next) =>
  validate({ body: schemaMap[req.params.type] })(req, res, next);

router.get(
  '/:type',
  authenticate,
  requireTenant,
  authorize('masterdata.read'),
  validate({ params: schemas.typeParams, query: schemas.listQuery }),
  controller.list
);

router.post(
  '/:type',
  authenticate,
  requireTenant,
  authorize('masterdata.create'),
  validate({ params: schemas.typeParams }),
  validateBodyByType(schemas.createSchemas),
  controller.create
);

router.get(
  '/:type/:id',
  authenticate,
  requireTenant,
  authorize('masterdata.read'),
  validate({ params: schemas.idParams }),
  controller.getById
);

router.patch(
  '/:type/:id',
  authenticate,
  requireTenant,
  authorize('masterdata.update'),
  validate({ params: schemas.idParams }),
  validateBodyByType(schemas.updateSchemas),
  controller.update
);

router.delete(
  '/:type/:id',
  authenticate,
  requireTenant,
  authorize('masterdata.delete'),
  validate({ params: schemas.idParams }),
  controller.remove
);

module.exports = router;
