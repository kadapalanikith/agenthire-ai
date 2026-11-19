'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('../../src/config/db');

let mongod;

async function startDatabase() {
  mongod = await MongoMemoryServer.create();
  // The MongoDB driver loads `os` with a dynamic import(), which Jest's
  // CommonJS VM cannot execute; inject it so the handshake metadata is built.
  await connectDatabase(mongod.getUri('agenthire-test'), { runtimeAdapters: { os: require('node:os') } });
  await mongoose.connection.syncIndexes();
}

async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function stopDatabase() {
  await disconnectDatabase();
  if (mongod) await mongod.stop();
}

module.exports = { startDatabase, clearDatabase, stopDatabase };
