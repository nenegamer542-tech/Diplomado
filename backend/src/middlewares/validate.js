'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validación centralizada con Zod.
 * El backend SIEMPRE revalida: nunca confía en formularios, query ni IDs.
 *
 * Uso: validate({ body: schema, query: qSchema, params: pSchema })
 */
function validate(schemas = {}) {
  return function validateMiddleware(req, res, next) {
    const details = {};

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        details[part] = result.error.issues.map((i) => ({
          field: i.path.join('.') || part,
          message: i.message,
        }));
      } else {
        // Reemplazamos por los datos saneados (ej. trim, lowercase, defaults).
        req[part] = result.data;
      }
    }

    if (Object.keys(details).length > 0) {
      return next(
        ApiError.unprocessable('Los datos enviados no son válidos.', details)
      );
    }
    return next();
  };
}

module.exports = validate;
