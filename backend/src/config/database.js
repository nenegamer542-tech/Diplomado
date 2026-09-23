'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

/**
 * Conexión a MongoDB Atlas.
 * - Sin bufferTimeoutMS eterno: las operaciones fallan con claridad.
 * - strictQuery para evitar filtros con campos inexistentes silenciosos.
 */
async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('MongoDB conectado'));
  mongoose.connection.on('error', (err) => logger.error({ err: err.message }, 'Error de MongoDB'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado'));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
}

async function disconnectDatabase() {
  await mongoose.connection.close();
}

module.exports = { connectDatabase, disconnectDatabase };
