'use strict';

/**
 * Error de aplicación con código HTTP y mensaje apto para el cliente.
 * Los errores generados deliberadamente aquí sí pueden mostrarse al usuario;
 * cualquier otro error se normaliza en errorHandler (ver mensaje genérico).
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - Código HTTP.
   * @param {string} message - Mensaje legible para el cliente (sin datos sensibles).
   * @param {object} [options]
   * @param {string} [options.code] - Código interno estable (ej. VALIDATION_ERROR).
   * @param {object} [options.details] - Detalles de validación/campo.
   * @param {boolean} [options.isOperational] - true si es esperado (no es bug).
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || 'ERROR';
    this.details = options.details;
    this.isOperational = options.isOperational !== false;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Solicitud inválida.', details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }
  static unauthorized(message = 'No autenticado.', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, { code });
  }
  static forbidden(message = 'No tiene permisos para realizar esta acción.') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }
  static notFound(message = 'Recurso no encontrado.') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }
  static conflict(message = 'El recurso ya existe.', details) {
    return new ApiError(409, message, { code: 'CONFLICT', details });
  }
  static unprocessable(message = 'Datos no válidos.', details) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', details });
  }
  static internal(message = 'Error interno del servidor.') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR' });
  }
}

module.exports = ApiError;
