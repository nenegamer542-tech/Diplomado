'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/**
 * Campos permitidos en POST/PATCH. `balance` NUNCA se acepta del cliente:
 * lo gestiona el servidor con incremento atómico (ADR-011).
 */
const CREATE_FIELDS = ['code', 'name', 'type', 'currency', 'status', 'notes'];

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'El código de la cuenta es obligatorio.')
      .max(20)
      .regex(/^[A-Za-z0-9._-]{1,20}$/, 'El código admite letras, números, puntos, guiones y guion bajo.'),
    name: z.string().trim().min(2, 'El nombre de la cuenta debe tener al menos 2 caracteres.').max(120),
    type: z.enum(['bank', 'cash', 'wallet']).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'La moneda debe ser un código ISO de 3 letras (p.ej. USD, MXN).')
      .transform((v) => v.toUpperCase())
      .optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

/** PATCH: parcial pero estricto (no vacío). */
const updateSchema = createSchema
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
  type: z.enum(['bank', 'cash', 'wallet']).optional(),
});

module.exports = { CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
