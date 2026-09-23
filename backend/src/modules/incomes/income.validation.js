'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/**
 * Ingresos APPEND-ONLY (ADR-011): se crean y se anulan; no existen PUT/PATCH
 * ni DELETE. `amount` SIEMPRE positivo; el signo lo aporta el movimiento.
 */
const CREATE_FIELDS = ['amount', 'date', 'category', 'method', 'accountId', 'customerId', 'reference', 'description'];
/** Campos del cuerpo de anulación. */
const VOID_FIELDS = ['reason'];

const amountPositive = z
  .number({ invalid_type_error: 'El importe debe ser numérico.' })
  .positive('El importe debe ser mayor que cero.')
  .max(1000000000000, 'El importe excede el máximo permitido.');

const createSchema = z
  .object({
    amount: amountPositive,
    date: z.coerce.date().optional(),
    category: z.string().trim().min(2, 'La categoría debe tener al menos 2 caracteres.').max(60),
    method: z.enum(['cash', 'transfer', 'card', 'check', 'other']).optional(),
    accountId: objectId,
    customerId: objectId.optional(),
    reference: z.string().trim().max(40).optional(),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

const voidSchema = z
  .object({
    reason: z.string().trim().min(2, 'El motivo de la anulación debe tener al menos 2 caracteres.').max(240),
  })
  .strict();

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['POSTED', 'VOID']).optional(),
  accountId: objectId.optional(),
  customerId: objectId.optional(),
  category: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { CREATE_FIELDS, VOID_FIELDS, createSchema, voidSchema, idParams, listQuery };
