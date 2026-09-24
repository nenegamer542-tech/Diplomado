'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST (previene escritura de campos desconocidos). */
const CREATE_FIELDS = [
  'sku',
  'name',
  'barcode',
  'description',
  'categoryId',
  'brandId',
  'unitId',
  'taxId',
  'category',
  'brand',
  'unit',
  'trackingMode',
  'costPrice',
  'salePrice',
  'taxRate',
  'minStock',
  'maxStock',
  'status',
];

const productObjectSchema = z
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
    categoryId: objectId.optional(),
    brandId: objectId.optional(),
    unitId: objectId.optional(),
    taxId: objectId.optional(),
    category: z.string().trim().max(60).optional(),
    brand: z.string().trim().max(100).optional(),
    unit: z.string().trim().max(20).optional(),
    trackingMode: z.enum(['none', 'lot', 'serial']).optional(),
    costPrice: z.number().min(0).optional(),
    salePrice: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    minStock: z.number().min(0).optional(),
    maxStock: z.number().min(0).nullable().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

const createSchema = productObjectSchema
  .refine((value) => value.maxStock == null || value.maxStock === undefined || value.maxStock >= (value.minStock ?? 0), {
    message: 'Stock máximo debe ser mayor o igual al stock mínimo.',
    path: ['maxStock'],
  });

/** PATCH: parcial pero estricto (no vacío). */
const updateSchema = productObjectSchema
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
