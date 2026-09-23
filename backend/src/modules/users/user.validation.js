'use strict';

const { z, objectId, email, paginationQuery } = require('../../utils/validators');
const { isStrongPassword } = require('../../utils/password');

const idParams = z.object({ id: objectId });

/** Campos que el body puede traer en POST/PATCH (para preventUnknownFields). */
const CREATE_FIELDS = ['companyId', 'name', 'lastName', 'email', 'password', 'roleId', 'branchId', 'status'];

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede exceder 72 caracteres.')
  .refine((v) => isStrongPassword(v), {
    message: 'La contraseña debe incluir letras y números.',
  });

const createSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(100),
    lastName: z.string().trim().max(100).optional(),
    email,
    password: passwordSchema,
    roleId: objectId,
    branchId: objectId.nullable().optional(),
    companyId: objectId.optional(), // sólo Super Admin de plataforma
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    email: email.optional(),
    password: passwordSchema.optional(),
    roleId: objectId.optional(),
    branchId: objectId.nullable().optional(),
    status: z.enum(['active', 'inactive', 'locked']).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive', 'locked']).optional(),
  roleId: objectId.optional(),
  branchId: objectId.optional(),
  // Sólo Super Admin (sin tenant): listado global de usuarios.
  allCompanies: z.enum(['true', 'false']).optional(),
});

module.exports = { idParams, CREATE_FIELDS, createSchema, updateSchema, listQuery, passwordSchema };
