'use strict';

const mongoose = require('mongoose');
const { MongoDBSaver } = require('@langchain/langgraph-checkpoint-mongodb');

/**
 * LangGraph checkpoints in the same MongoDB as the domain data (local Docker
 * or Atlas). They are the source of truth for resuming a workflow.
 */
async function createMongoCheckpointer() {
  const client = mongoose.connection.getClient();
  const saver = new MongoDBSaver({
    client,
    dbName: mongoose.connection.name,
    checkpointCollectionName: 'checkpoints',
    checkpointWritesCollectionName: 'checkpoint_writes',
  });
  if (typeof saver.setup === 'function') await saver.setup();
  return saver;
}

module.exports = { createMongoCheckpointer };
