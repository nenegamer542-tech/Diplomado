'use strict';

/**
 * Formato estándar de respuesta de la API.
 * Todas las respuestas usan el mismo envoltorio para facilitar al cliente:
 * { success, data, meta? }  |  { success:false, error:{ code, message, details? } }
 */

function ok(res, data, meta, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, data, meta) {
  return ok(res, data, meta, 201);
}

function noContent(res) {
  return res.status(204).send();
}

function fail(res, statusCode, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

module.exports = { ok, created, noContent, fail };
