'use strict';

const { z, objectId, paginationQuery } = require('../../utils/validators');

const idParams = z.object({ id: objectId });

const CREATE_FIELDS = ['code', 'label', 'description', 'permissions', 'status'];

const permissionCode = z
  .string()
  .regex(/^[a-z][a-z0-9_.]*$/, 'Código de permiso inválido (formato modulo.recurso.accion).');

const createSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_]{2,39}$/, 'El código debe tener 3-40 caracteres (minúsculas, números, _).'),
    label: z.string().trim().min(2, 'El nombre visible debe tener al menos 2 caracteres.').max(60),
    description: z.string().trim().max(240).optional(),
    permissions: z.array(permissionCode).max(300).default([]),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

const updateSchema = createSchema.partial().strict();

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
  companyId: objectId.optional(), // solo Super Admin listando roles de una empresa
});

module.exports = { idParams, CREATE_FIELDS, createSchema, updateSchema, listQuery };
