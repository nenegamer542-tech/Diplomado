'use strict';

const { Router } = require('express');
const controller = require('./audit.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { z } = require('../../utils/validators');

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  module: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  userId: z.string().max(64).optional(),
  result: z.enum(['SUCCESS', 'FAILURE']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // Sólo Super Admin (sin tenant): auditoría de plataforma (companyId null).
  allCompanies: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/v1/audit          — listado (requiere audit.read)
 * GET /api/v1/audit/:id      — detalle (requiere audit.read)
 * NOTA: no hay POST/PUT/DELETE. La auditoría es inmutable vía API.
 */
router.get('/', authenticate, authorize('audit.read'), validate({ query: listQuery }), controller.list);
router.get('/:id', authenticate, authorize('audit.read'), controller.getById);

module.exports = router;
