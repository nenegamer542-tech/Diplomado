'use strict';

/**
 * Variables de entorno mínimas para Jest.
 * Se ejecuta ANTES de cargar cualquier módulo de src/ porque config/env.js
 * termina el proceso si faltan MONGO_URI / secretos JWT.
 *
 * Para pruebas de integración reales exporta MONGO_URI_TEST (base de datos
 * DESCARTABLE, nunca de producción).
 */

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/erp_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-0123456789abcdef';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:19006';
