'use strict';

/**
 * Arranque de la BD de test para Jest (ver docs/qa/matriz-pruebas.md).
 *
 * - Si defines MONGO_URI_TEST (p. ej. MongoDB Atlas) se respeta y NO se hace
 *   nada: misma semántica que siempre.
 * - Si no, se levanta una base DESCARTABLE efímera con mongodb-memory-server.
 *   Como globalSetup corre ANTES de que Jest reparta los workers, la variable
 *   ya está disponible en process.env de las suites (describeIfDb la ve).
 *
 * Si la memoria no puede arrancar (binario sin descargar, sin red, etc.) se
 * avisa y se continúa: las unitarias NO dependen de esto y las integraciones
 * se omiten como hasta ahora.
 */
module.exports = async function globalSetup() {
  if (process.env.MONGO_URI_TEST) return;

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI_TEST = mongod.getUri('erp_test');
    // globalSetup y globalTeardown comparten este proceso con --runInBand.
    globalThis.__MONGO_MEMORY_SERVER__ = mongod;
    // eslint-disable-next-line no-console
    console.log('  BD de test efímera (mongodb-memory-server) lista en', process.env.MONGO_URI_TEST);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '  AVISO: no se pudo iniciar mongodb-memory-server; las suites de ' +
        'integración se omitirán (define MONGO_URI_TEST para ejecutarlas).',
      err && err.message ? err.message : err
    );
  }
};
