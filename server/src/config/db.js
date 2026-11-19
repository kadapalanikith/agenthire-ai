'use strict';

const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// NoSQL-injection defence in depth: Mongoose wraps filter values that look
// like query operators ($gt, $ne, ...) in $eq.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB (local Docker or Atlas — the URI decides).
 * `extraOptions` are passed to the driver (used by the test harness).
 */
async function connectDatabase(uri, extraOptions = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...extraOptions });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected };
