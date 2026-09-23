'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Previene envíos de campos no permitidos (mas assignment).
 * Evita que un cliente inyecte campos como companyId, roleId, permissions,
 * status o __proto__ directamente en el body.
 *
 * Uso: preventUnknownFields(ALLOWED) como último middleware de validación.
 */
function preventUnknownFields(allowed) {
  const allowedSet = new Set(allowed);

  return function (req, res, next) {
    if (!req.body || typeof req.body !== 'object') return next();

    const received = Object.keys(req.body);
    const unknown = received.filter((k) => !allowedSet.has(k));

    if (unknown.length > 0) {
      return next(
        ApiError.badRequest(`Campos no permitidos: ${unknown.join(', ')}.`, {
          fields: unknown,
        })
      );
    }
    return next();
  };
}

module.exports = preventUnknownFields;
