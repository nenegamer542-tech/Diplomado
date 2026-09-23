'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST (previene escritura de campos desconocidos). */
const CREATE_FIELDS = [
  'sku',
  'name',
  'barcode',
  'description',
  'category',
  'unit',
  'costPrice',
  'salePrice',
  'taxRate',
  'minStock',
  'status',
];

const createSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, 'El SKU es obligatorio.')
      .max(40)
      .regex(/^[A-Za-z0-9._-]{1,40}$/, 'El SKU admite letras, números, puntos, guiones y guion bajo.'),
    name: z.string().trim().min(2, 'El nombre del producto debe tener al menos 2 caracteres.').max(120),
    barcode: z.string().trim().max(64).optional(),
    description: z.string().trim().max(500).optional(),
    category: z.string().trim().max(60).optional(),
    unit: z.string().trim().max(20).optional(),
    costPrice: z.number().min(0).optional(),
    salePrice: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    minStock: z.number().min(0).optional(),
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
  category: z.string().trim().max(60).optional(),
});

module.exports = { CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
