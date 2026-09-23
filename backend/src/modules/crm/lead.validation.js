'use strict';

const { z } = require('zod');
const { objectId, email, paginationQuery } = require('../../utils/validators');

/** Estados del ciclo de vida de un lead (ADR-012). */
const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];
const LEAD_SOURCES = ['web', 'referral', 'call', 'event', 'other'];

/** Campos permitidos en POST/PATCH de leads. */
const CREATE_FIELDS = [
  'name',
  'company',
  'email',
  'phone',
  'source',
  'status',
  'expectedAmount',
  'notes',
  'assignedTo',
];

const createSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120),
    company: z.string().trim().max(120).optional(),
    email: email.optional(),
    phone: z.string().trim().max(40).optional(),
    source: z.enum(LEAD_SOURCES).optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    expectedAmount: z
      .number({ invalid_type_error: 'El importe previsto debe ser numérico.' })
      .min(0, 'El importe previsto no puede ser negativo.')
      .max(1000000000000, 'El importe previsto excede el máximo permitido.')
      .optional(),
    notes: z.string().trim().max(500).optional(),
    assignedTo: objectId.optional(),
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
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedTo: objectId.optional(),
});

module.exports = { LEAD_STATUSES, LEAD_SOURCES, CREATE_FIELDS, createSchema, updateSchema, idParams, listQuery };
