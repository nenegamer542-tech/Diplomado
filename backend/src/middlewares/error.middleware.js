'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const env = require('../config/env');

/** 404 para rutas inexistentes. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Manejador GLOBAL de errores (último middleware de la cadena).
 *
 * Reglas:
 *  - El cliente NUNCA ve stack traces, mensajes de Mongo ni credenciales.
 *  - Los errores de Mongoose se traducen a mensajes legibles.
 *  - Los detalles técnicos completos sí van al log interno.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // --- Traducción de errores de infraestructura a errores de negocio ---

  // ID malformado
  if (err.name === 'CastError') {
    error = ApiError.badRequest('El identificador proporcionado no es válido.');
  }

  // Validación de Mongoose
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.keys(err.errors).map((k) => ({
      field: k,
      message: err.errors[k].message,
    }));
    error = ApiError.unprocessable('Los datos enviados no son válidos.', details);
  }

  // Índice duplicado (ej. SKU o email único)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    const label = fields.length ? fields.join(', ') : 'el registro';
    error = ApiError.conflict(`Ya existe un registro con ese valor en: ${label}.`, {
      fields,
    });
  }

  if (!(error instanceof ApiError)) {
    // Error NO esperado (bug): mensaje genérico al cliente, detalle en log.
    logger.error(
      {
        err: { message: err.message, stack: err.stack },
        req: { method: req.method, url: req.originalUrl, userId: req.user?.id },
      },
      'Error no controlado'
    );
    error = ApiError.internal('Ocurrió un error interno. Intente de nuevo o contacte al administrador.');
  } else if (error.statusCode >= 500) {
    logger.error({ err: { message: err.message, stack: err.stack } }, 'Error 5xx');
  } else {
    logger.warn(
      { code: error.code, status: error.statusCode, msg: error.message, url: req.originalUrl },
      'Error operacional'
    );
  }

  const body = {
    success: false,
    error: {
      code: error.code || 'ERROR',
      message: error.message,
    },
  };
  if (error.details) body.error.details = error.details;
  // Solo en desarrollo mostramos el nombre interno del error (nunca stack).
  if (!env.isProduction && !error.isOperational) {
    body.error.internalName = err.name;
  }

  res.status(error.statusCode || 500).json(body);
}

module.exports = { notFound, errorHandler };
