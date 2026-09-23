'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Traducción de errores de infraestructura a mensajes de negocio legibles.
 * El usuario NUNCA debe ver "MongoServerError", "TypeError" ni stack traces.
 */

function isDuplicateKeyError(err) {
  // Boolean(): `err && ...` devolvía `null`/`undefined` para entradas sin código.
  return Boolean(err && err.code === 11000);
}

function duplicateFields(err) {
  return Object.keys(err.keyValue || {});
}

/**
 * Lanza un 409 con mensaje claro si Mongo reporta duplicado.
 * Uso en services: await translateDuplicate(err, 'SKU FC671485')
 */
function rethrowDuplicate(err, label = 'el registro') {
  if (isDuplicateKeyError(err)) {
    const fields = duplicateFields(err);
    const detail = fields.length ? fields.join(', ') : 'valor único';
    throw ApiError.conflict(`Ya existe un registro con ${detail}: ${label}.`, { fields });
  }
  throw err;
}

/**
 * Convierte errores de validación de Mongoose en 422 legible.
 */
function rethrowValidation(err) {
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.keys(err.errors).map((k) => ({
      field: k,
      message: err.errors[k].message,
    }));
    throw ApiError.unprocessable('Los datos enviados no son válidos.', details);
  }
  throw err;
}

/** Envuelve save/create/update para traducir errores comunes. */
async function withTranslatedErrors(fn, label) {
  try {
    return await fn();
  } catch (err) {
    if (isDuplicateKeyError(err)) rethrowDuplicate(err, label);
    rethrowValidation(err);
    throw err; // inalcanzable defensivo
  }
}

module.exports = { rethrowDuplicate, rethrowValidation, withTranslatedErrors, isDuplicateKeyError };
