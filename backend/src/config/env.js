'use strict';

/**
 * Carga y valida variables de entorno al arrancar.
 * Si falta una variable obligatoria la aplicación NO arranca (falla rápido).
 * Nunca se leen secretos desde código fuente.
 */

const fs = require('fs');
const path = require('path');

// El .env vive en la RAÍZ del proyecto (ver .env.example). Fallback al .env
// del cwd por si se genera un archivo local dentro de backend/.
const rootEnvPath = path.resolve(__dirname, '../../../.env');
require('dotenv').config(fs.existsSync(rootEnvPath) ? { path: rootEnvPath } : undefined);

// Accept the legacy MONGODB_URI name while preferring the canonical MONGO_URI.
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const REQUIRED = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function fail(message) {
  // Se imprime en consola a propósito: es el arranque, el logger aún no existe.
  console.error(`[config] ${message}`);
  process.exit(1);
}

const missing = REQUIRED.filter((key) => !process.env[key]);
if (!mongoUri) missing.unshift('MONGO_URI (o MONGODB_URI)');
if (missing.length) {
  fail(`Faltan variables de entorno obligatorias: ${missing.join(', ')}. Copia .env.example a .env.`);
}

if (process.env.NODE_ENV === 'production') {
  const weak = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => process.env[key].length < 32 || process.env[key].includes('cambie-este')
  );
  if (weak.length) {
    fail(`En producción las claves JWT deben tener >=32 caracteres y ser únicas: ${weak.join(', ')}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  mongoUri,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || '',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  isTest: process.env.NODE_ENV === 'test',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = env;
