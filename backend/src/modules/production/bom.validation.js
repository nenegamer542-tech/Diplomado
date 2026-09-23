'use strict';

const { z } = require('zod');
const { objectId, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST/PATCH de listas de materiales. */
const CREATE_FIELDS = ['productId', 'components', 'notes', 'status'];

const quantityPositive = z
  .number({ invalid_type_error: 'La cantidad debe ser numérica.' })
  .positive('La cantidad debe ser mayor que cero.')
  .max(1000000000, 'La cantidad excede el máximo permitido.');

const componentSchema = z
  .object({
    productId: objectId,
    quantity: quantityPositive,
  })
  .strict();

/** Componente repetido o igual al producto terminado ⇒ inválido (422). */
function refineComponents(values) {
  if (!values.components) return true;
  const seen = new Set();
  for (const c of values.components) {
    if (seen.has(String(c.productId))) return false;
    seen.add(String(c.productId));
  }
  return true;
}

const createSchema = z
  .object({
    productId: objectId,
    components: z.array(componentSchema).min(1, 'La lista debe incluir al menos un componente.'),
    notes: z.string().trim().max(500).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict()
  .refine((v) => v.components.every((c) => String(c.productId) !== String(v.productId)), {
    message: 'El componente debe ser distinto del producto terminado.',
    path: ['components'],
  })
  .refine(refineComponents, {
    message: 'La lista contiene componentes repetidos.',
    path: ['components'],
  });

const updateSchema = z
  .object({
    productId: objectId.optional(),
    components: z.array(componentSchema).min(1, 'La lista debe incluir al menos un componente.').optional(),
    notes: z.string().trim().max(500).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.components === undefined ||
      v.components.every((c) => String(c.productId) !== String(v.productId || '')),
    {
      message: 'El componente debe ser distinto del producto terminado.',
      path: ['components'],
    }
  )
  .refine((v) => v.components === undefined || refineComponents(v), {
    message: 'La lista contiene componentes repetidos.',
    path: ['components'],
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
  productId: objectId.optional(),
});

module.exports = { CREATE_FIELDS, quantityPositive, componentSchema, createSchema, updateSchema, idParams, listQuery };
