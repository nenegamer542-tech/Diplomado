'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');
const { quantityPositive } = require('./bom.validation');

/** Campos permitidos en POST/PATCH de órdenes de producción. */
const CREATE_FIELDS = ['bomId', 'warehouseId', 'quantity', 'notes'];
/** Campos del cuerpo de cancelación (motivo obligatorio). */
const CANCEL_FIELDS = ['reason'];

const createSchema = z
  .object({
    bomId: objectId,
    // Opcional: si falta se usa el almacén predeterminado de la empresa.
    warehouseId: objectId.optional(),
    quantity: quantityPositive,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

const updateSchema = z
  .object({
    bomId: objectId.optional(),
    warehouseId: objectId.optional(),
    quantity: quantityPositive.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

/** RELEASE y DONE no admiten cuerpo (tolera body ausente). */
const emptyBody = z.object({}).strict().default({});

const cancelSchema = z
  .object({
    reason: z.string().trim().min(2, 'El motivo de la cancelación debe tener al menos 2 caracteres.').max(240),
  })
  .strict();

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['DRAFT', 'RELEASED', 'DONE', 'CANCELLED']).optional(),
  bomId: objectId.optional(),
  warehouseId: objectId.optional(),
  productId: objectId.optional(),
});

module.exports = {
  CREATE_FIELDS,
  CANCEL_FIELDS,
  createSchema,
  updateSchema,
  emptyBody,
  cancelSchema,
  idParams,
  listQuery,
};
