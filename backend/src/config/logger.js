'use strict';

const pino = require('pino');
const env = require('./env');

/**
 * Logger estructurado.
 * Registra detalles técnicos aquí (nunca se devuelven al cliente).
 * En test silenciamos para no ensuciar la salida de Jest.
 */
const logger = pino({
  level: env.isTest ? 'silent' : env.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      'secret',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'erp-backend' },
});

module.exports = logger;
