'use strict';

const { z } = require('zod');
const { objectId, email, paginationQuery } = require('../../utils/validators');

/** Campos permitidos en POST/PATCH de empleados. */
const CREATE_FIELDS = [
  'documentId',
  'firstName',
  'lastName',
  'email',
  'position',
  'department',
  'hireDate',
  'salary',
  'status',
  'terminationDate',
  'notes',
];

const createSchema = z
  .object({
    documentId: z.string().trim().min(3, 'El documento de identidad debe tener al menos 3 caracteres.').max(30),
    firstName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(80),
    lastName: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres.').max(80),
    email: email.optional(),
    position: z.string().trim().max(80).optional(),
    department: z.string().trim().max(80).optional(),
    hireDate: z.coerce.date({ invalid_type_error: 'La fecha de ingreso no es válida.' }).optional(),
    salary: z
      .number({ invalid_type_error: 'El salario debe ser numérico.' })
      .min(0, 'El salario no puede ser negativo.')
      .max(1000000000000, 'El salario excede el máximo permitido.')
      .optional(),
    status: z.enum(['active', 'inactive']).optional(),
    terminationDate: z.coerce.date({ invalid_type_error: 'La fecha de baja no es válida.' }).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

/** PATCH: parcial pero estricto; al menos un campo. */
const updateSchema = createSchema
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debe indicar al menos un campo a actualizar.',
  });

const idParams = z.object({ id: objectId });

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'inactive']).optional(),
  department: z.string().trim().max(80).optional(),
});

module.exports = { CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
