'use strict';

/**
 * Normaliza cualquier ObjectId inválido a null para que las validaciones
 * de Zod lo reporten como "ID inválido" y no como error 500 de Mongoose.
 */
const { Types } = require('mongoose');

function toObjectIdOrNull(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return Types.ObjectId.isValid(String(value)) ? String(value) : value; // deja el valor crudo para que Zod falle
}

function isObjectId(value) {
  return Types.ObjectId.isValid(String(value));
}

module.exports = { toObjectIdOrNull, isObjectId };
