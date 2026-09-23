'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { fail } = require('../utils/response');

/**
 * Límite de peticiones para mitigar fuerza bruta y abuso.
 * En test se desactiva para no interferir con la suite.
 */
function buildLimiter({ windowMs = 15 * 60 * 1000, max = 100, message } = {}) {
  if (env.isTest) return (req, res, next) => next();

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message } },
    handler: (req, res) =>
      fail(res, 429, 'RATE_LIMIT', message || 'Demasiadas peticiones. Intente más tarde.'),
  });
}

/** Límite estricto para login (fuerza bruta). */
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de autenticación. Espere 15 minutos.',
});

/** Límite general de la API. */
const apiLimiter = buildLimiter({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: 'Límite de peticiones excedido.',
});

module.exports = { buildLimiter, authLimiter, apiLimiter };
