'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

const MOVEMENT_TYPES = ['ENTRY', 'EXIT', 'ADJUSTMENT', 'TRANSFER'];

/** Campos permitidos en POST de entradas/salidas. */
const ENTRY_EXIT_FIELDS = ['productId', 'warehouseId', 'quantity', 'reason', 'reference', 'traceability'];
/** Campos permitidos en POST de ajustes (reason obligatorio). */
const ADJUSTMENT_FIELDS = ['productId', 'warehouseId', 'quantity', 'reason', 'reference', 'traceability'];
/** Campos permitidos en POST de transferencias. */
const TRANSFER_FIELDS = ['productId', 'fromWarehouseId', 'toWarehouseId', 'quantity', 'reason', 'reference', 'traceability'];

const quantityPositive = z
  .number({ invalid_type_error: 'La cantidad debe ser numérica.' })
  .positive('La cantidad debe ser mayor que cero.')
  .max(1000000000, 'La cantidad excede el máximo permitido.');

const traceabilitySchema = z.array(z.object({
  identifier: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._/-]+$/),
  quantity: quantityPositive,
  expiryDate: z.coerce.date().optional(),
}).strict()).min(1).max(100).optional();

const entryExitCommon = {
  productId: objectId,
  warehouseId: objectId,
  quantity: quantityPositive,
  reason: z.string().trim().max(240).optional(),
  reference: z.string().trim().max(60).optional(),
  traceability: traceabilitySchema,
};

const entrySchema = z.object(entryExitCommon).strict();
const exitSchema = z.object(entryExitCommon).strict();

/** Ajuste: recuento absoluto (>= 0) y motivo obligatorio. */
const adjustmentSchema = z
  .object({
    productId: objectId,
    warehouseId: objectId,
    quantity: z
      .number({ invalid_type_error: 'La cantidad debe ser numérica.' })
      .min(0, 'La cantidad no puede ser negativa.')
      .max(1000000000, 'La cantidad excede el máximo permitido.'),
    reason: z.string().trim().min(2, 'El motivo del ajuste es obligatorio.').max(240),
    reference: z.string().trim().max(60).optional(),
    traceability: traceabilitySchema,
  })
  .strict();

const transferSchema = z
  .object({
    productId: objectId,
    fromWarehouseId: objectId,
    toWarehouseId: objectId,
    quantity: quantityPositive,
    reason: z.string().trim().max(240).optional(),
    reference: z.string().trim().max(60).optional(),
    traceability: traceabilitySchema,
  })
  .strict()
  .refine((v) => String(v.fromWarehouseId) !== String(v.toWarehouseId), {
    message: 'Los almacenes de origen y destino deben ser distintos.',
    path: ['toWarehouseId'],
  });

const idParams = z.object({ id: objectId });

const stockQuery = paginationQuery.extend({
  warehouseId: objectId.optional(),
  productId: objectId.optional(),
});

const movementsQuery = paginationQuery.extend({
  type: z.enum(MOVEMENT_TYPES).optional(),
  productId: objectId.optional(),
  warehouseId: objectId.optional(),
  from: z.coerce.date({ invalid_type_error: 'La fecha "from" no es válida.' }).optional(),
  to: z.coerce.date({ invalid_type_error: 'La fecha "to" no es válida.' }).optional(),
});

const traceabilityQuery = paginationQuery.extend({
  productId: objectId,
  warehouseId: objectId.optional(),
  kind: z.enum(['lot', 'serial']).optional(),
});

module.exports = {
  MOVEMENT_TYPES,
  ENTRY_EXIT_FIELDS,
  ADJUSTMENT_FIELDS,
  TRANSFER_FIELDS,
  entrySchema,
  exitSchema,
  adjustmentSchema,
  transferSchema,
  idParams,
  stockQuery,
  movementsQuery,
  traceabilityQuery,
};
