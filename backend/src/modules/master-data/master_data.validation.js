'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

const typeParams = z.object({
  type: z.enum(['categories', 'brands', 'units', 'currencies', 'taxes']),
});
const idParams = typeParams.extend({ id: objectId });
const common = {
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(240).optional(),
  status: z.enum(['active', 'inactive']).optional(),
};

function updateSchema(schema) {
  return schema.partial().strict().refine((body) => Object.keys(body).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });
}

const createSchemas = {
  categories: z.object(common).strict(),
  brands: z.object(common).strict(),
  units: z
    .object({
      ...common,
      symbol: z.string().trim().min(1).max(12),
      decimalPlaces: z.number().int().min(0).max(6).optional(),
      allowFractions: z.boolean().optional(),
    })
    .strict(),
  currencies: z
    .object({
      ...common,
      code: z.string().trim().regex(/^[A-Za-z]{3}$/),
      symbol: z.string().trim().min(1).max(12).optional(),
      decimalPlaces: z.number().int().min(0).max(6).optional(),
    })
    .strict(),
  taxes: z
    .object({
      ...common,
      rate: z.number().min(0).max(100),
    })
    .strict(),
};

const updateSchemas = Object.fromEntries(
  Object.entries(createSchemas).map(([type, schema]) => [type, updateSchema(schema)])
);

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().trim().max(100).optional(),
});

module.exports = { typeParams, idParams, createSchemas, updateSchemas, listQuery };
