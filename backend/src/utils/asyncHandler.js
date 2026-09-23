'use strict';

/**
 * Envuelve un handler async para propagar errores al middleware global.
 * Evita try/catch repetido en cada controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
