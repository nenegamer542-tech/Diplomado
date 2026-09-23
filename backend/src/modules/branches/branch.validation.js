'use strict';

const { z, objectId, paginationQuery } = require('../../utils/validators');

const idParams = z.object({ id: objectId });

const CREATE_FIELDS = ['code', 'name', 'address', 'phone', 'isDefault', 'status'];

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,20}$/, 'El código admite letras, números, guiones y guion bajo (máx. 20).'),
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120),
    address: z.string().trim().max(240).optional(),
    phone: z.string().trim().max(30).optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

const updateSchema = createSchema.partial().strict();

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

module.exports = { idParams, CREATE_FIELDS, createSchema, updateSchema, listQuery };
