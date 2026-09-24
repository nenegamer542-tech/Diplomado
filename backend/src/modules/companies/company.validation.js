'use strict';

const { z, objectId, email, paginationQuery } = require('../../utils/validators');

const idParams = z.object({ id: objectId });

const createSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120),
    legalName: z.string().trim().max(160).optional(),
    taxId: z.string().trim().max(30).optional(),
    email: email.optional(),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(240).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'La moneda debe ser un código de 3 letras.')
      .optional(),
    timezone: z.string().trim().max(60).optional(),
  })
  .strict(); // rechaza campos desconocidos (mas assignment)

const updateSchema = createSchema
  .partial()
  .extend({ status: z.enum(['active', 'suspended']).optional() })
  .strict();

const listQuery = paginationQuery.extend({
  status: z.enum(['active', 'suspended']).optional(),
});

const settingsSchema = z
  .object({
    locale: z.enum(['es-MX', 'en-US']).optional(),
    dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
    fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  })
  .strict()
  .refine((settings) => Object.keys(settings).length > 0, {
    message: 'Debe enviar al menos un ajuste.',
  });

module.exports = { idParams, createSchema, updateSchema, listQuery, settingsSchema };
