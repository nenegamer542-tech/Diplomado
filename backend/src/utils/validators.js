'use strict';

const { z } = require('zod');
const { isObjectId } = require('./objectId');

/** ObjectId válido de Mongo (string de 24 hex). */
const objectId = z
  .string()
  .refine((v) => isObjectId(v), { message: 'Identificador inválido.' });

/** Campo email normalizado. */
const email = z.string().trim().toLowerCase().email('Correo electrónico inválido.');

/** Paginación común para listados. */
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortBy: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

module.exports = { z, objectId, email, paginationQuery };
