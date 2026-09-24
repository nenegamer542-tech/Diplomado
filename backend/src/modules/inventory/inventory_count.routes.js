'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize, requireTenant } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const preventUnknownFields = require('../../middlewares/preventUnknownFields');
const controller = require('./inventory_count.controller');
const schemas = require('./inventory_count.validation');

const router = Router();
router.get('/', authenticate, requireTenant, authorize('inventory.read'), validate({ query: schemas.listQuery }), controller.list);
router.get('/:id', authenticate, requireTenant, authorize('inventory.read'), validate({ params: schemas.idParams }), controller.getById);
router.post('/', authenticate, requireTenant, authorize('inventory.adjustments.create'), preventUnknownFields(schemas.CREATE_FIELDS), validate({ body: schemas.createSchema }), controller.create);
router.post('/:id/post', authenticate, requireTenant, authorize('inventory.adjustments.create'), preventUnknownFields([]), validate({ params: schemas.idParams }), controller.post);

module.exports = router;
