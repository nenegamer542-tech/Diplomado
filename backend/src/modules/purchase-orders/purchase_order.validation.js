'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST/PATCH (status/companyId/total son de servidor). */
const CREATE_FIELDS = ['supplierId', 'warehouseId', 'lines', 'notes'];
/** Campos permitidos en el cuerpo de la aprobación: ninguno. */
const APPROVE_FIELDS = [];
/** Campos permitidos al rechazar. */
const REJECT_FIELDS = ['reason'];

const quantityPositive = z
  .number({ invalid_type_error: 'La cantidad debe ser numérica.' })
  .positive('La cantidad debe ser mayor que cero.')
  .max(1000000000, 'La cantidad excede el máximo permitido.');

const lineSchema = z
  .object({
    productId: objectId,
    quantity: quantityPositive,
    traceability: z.array(z.object({
      identifier: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._/-]+$/),
      quantity: quantityPositive,
      expiryDate: z.coerce.date().optional(),
    }).strict()).min(1).max(100).optional(),
    unitCost: z.number({ invalid_type_error: 'El costo debe ser numérico.' }).min(0, 'El costo no puede ser negativo.'),
  })
  .strict();

const createSchema = z
  .object({
    supplierId: objectId,
    warehouseId: objectId.optional(),
    lines: z.array(lineSchema).min(1, 'La orden debe incluir al menos una línea.').max(100),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

/** PATCH: parcial pero estricto (sólo documentos en DRAFT lo permiten). */
const updateSchema = createSchema
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

const approveSchema = z.object({}).strict();

const rejectSchema = z
  .object({
    reason: z.string().trim().min(2, 'El motivo del rechazo debe tener al menos 2 caracteres.').max(240),
  })
  .strict();

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['DRAFT', 'APPROVED', 'REJECTED']).optional(),
  supplierId: objectId.optional(),
});

module.exports = {
  CREATE_FIELDS,
  APPROVE_FIELDS,
  REJECT_FIELDS,
  createSchema,
  updateSchema,
  approveSchema,
  rejectSchema,
  idParams,
  listQuery,
};
