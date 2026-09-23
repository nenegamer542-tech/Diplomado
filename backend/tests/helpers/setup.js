'use strict';

/**
 * Infraestructura de las pruebas de INTEGRACIÓN (API completa con supertest).
 *
 * Importante:
 *  - Las suites sólo corren si defines MONGO_URI_TEST apuntando a una base de
 *    datos DESCARTABLE (nunca de producción). Sin ella, Jest las omite.
 *  - Los tests corren en serie (npm test usa --runInBand): cada archivo
 *    limpia la base en su beforeAll.
 */

const mongoose = require('mongoose');
const app = require('../../src/app');

const hasTestDb = Boolean(process.env.MONGO_URI_TEST);

/** describe normal si hay BD de test; describe.skip si no. */
const describeIfDb = hasTestDb ? describe : describe.skip;

async function connectTestDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI_TEST, { serverSelectionTimeoutMS: 5000 });
  }
  await clearDb();
}

async function clearDb() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function closeTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.connection.close();
  }
}

module.exports = { app, describeIfDb, connectTestDb, clearDb, closeTestDb };
