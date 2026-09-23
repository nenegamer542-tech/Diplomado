'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos del presupuesto (year/month/category forman la clave única). */
const CREATE_FIELDS = ['year', 'month', 'category', 'plannedAmount', 'notes'];

const createSchema = z
  .object({
    year: z.coerce.number({ invalid_type_error: 'El año debe ser numérico.' }).int().min(2000).max(2100),
    month: z.coerce.number({ invalid_type_error: 'El mes debe ser numérico.' }).int().min(1, 'El mes debe estar entre 1 y 12.').max(12, 'El mes debe estar entre 1 y 12.'),
    category: z.string().trim().min(2, 'La categoría debe tener al menos 2 caracteres.').max(60),
    plannedAmount: z
      .number({ invalid_type_error: 'El importe planeado debe ser numérico.' })
      .min(0, 'El importe planeado no puede ser negativo.')
      .max(1000000000000, 'El importe excede el máximo permitido.'),
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
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  category: z.string().trim().max(60).optional(),
});

module.exports = { CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
