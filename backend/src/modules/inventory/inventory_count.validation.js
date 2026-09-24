'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

const quantity = z.number().min(0).max(1000000000);
const CREATE_FIELDS = ['warehouseId', 'lines'];
const createSchema = z.object({
  warehouseId: objectId,
  lines: z.array(z.object({ productId: objectId, countedQuantity: quantity }).strict()).min(1).max(500),
}).strict().refine((body) => new Set(body.lines.map((line) => line.productId)).size === body.lines.length, {
  message: 'Un producto sólo puede aparecer una vez por conteo.',
  path: ['lines'],
});
const idParams = z.object({ id: objectId });
const listQuery = paginationQuery.extend({
  status: z.enum(['DRAFT', 'POSTING', 'PARTIAL', 'POSTED']).optional(),
  warehouseId: objectId.optional(),
});

module.exports = { CREATE_FIELDS, createSchema, idParams, listQuery };
