'use strict';

/**
 * Punto de arranque del backend.
 *  - Valida variables de entorno (config/env.js falla rápido si faltan).
 *  - Conecta a MongoDB Atlas antes de aceptar tráfico.
 *  - Cierra ordenadamente ante SIGINT/SIGTERM (graceful shutdown).
 */

const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function main() {
  await connectDatabase();

  const server = app.listen(env.port, () => {
    logger.info(
      { port: env.port, env: env.nodeEnv, prefix: env.apiPrefix },
      `API escuchando en http://localhost:${env.port}${env.apiPrefix}`
    );
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Cerrando servidor...');

    const forceExit = setTimeout(() => {
      logger.error('Cierre forzado tras 10s sin terminar.');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(async () => {
      await disconnectDatabase().catch((err) =>
        logger.error({ err: err.message }, 'Error al cerrar MongoDB')
      );
      logger.info('Servidor detenido.');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Última red de seguridad: nunca un crash silencioso en producción.
process.on('unhandledRejection', (reason) => {
  logger.error(
    { reason: reason instanceof Error ? reason.message : String(reason) },
    'unhandledRejection'
  );
});

main().catch((err) => {
  logger.error({ err: err.message }, 'Fallo al iniciar la API');
  process.exit(1);
});
