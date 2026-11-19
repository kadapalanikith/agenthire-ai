'use strict';

const { getEnv } = require('./config/env');
const { initSpecs } = require('./utils/specLoader');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const { logger } = require('./utils/logger');

async function main() {
  const env = getEnv(); // fail fast on invalid configuration
  const { versions } = initSpecs(); // fail fast on invalid specs
  logger.info({ specs: Object.keys(versions).length }, 'Specs loaded');

  await connectDatabase(env.MONGODB_URI);

  const { createApp } = require('./app');
  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'AgentHire API listening');
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

main().catch((err) => {
  // Config/spec errors list names only, never secret values.
  logger.fatal({ err: { message: err.message, code: err.code } }, 'Failed to start server');
  process.exit(1);
});
