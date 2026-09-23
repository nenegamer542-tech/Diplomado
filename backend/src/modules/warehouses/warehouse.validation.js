'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST/PATCH (previene escritura de campos desconocidos). */
const CREATE_FIELDS = ['code', 'name', 'branchId', 'address', 'isDefault', 'status'];

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'El código del almacén es obligatorio.')
      .max(20)
      .regex(/^[A-Za-z0-9._-]{1,20}$/, 'El código admite letras, números, puntos, guiones y guion bajo.'),
    name: z.string().trim().min(2, 'El nombre del almacén debe tener al menos 2 caracteres.').max(80),
    branchId: objectId.optional().nullable(),
    address: z.string().trim().max(200).optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional(),
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
});

module.exports = { CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
