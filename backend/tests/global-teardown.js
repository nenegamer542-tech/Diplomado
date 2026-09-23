'use strict';

/** Detiene la BD efímera creada en global-setup.js (no-op si no existe). */
module.exports = async function globalTeardown() {
  const mongod = globalThis.__MONGO_MEMORY_SERVER__;
  if (mongod) {
    await mongod.stop();
    globalThis.__MONGO_MEMORY_SERVER__ = null;
  }
};
