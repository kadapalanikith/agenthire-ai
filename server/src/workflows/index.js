'use strict';

const { buildHiringGraph } = require('./hiringGraph');
const { createMongoCheckpointer } = require('./checkpointer');
const { WorkflowRunner, setWorkflowRunner } = require('./runner');
const { getLlmClient } = require('../agents/shared/llmClient');
const { getEmbedder } = require('../rag/embedder');
const { getVectorStore, ensureCollections } = require('../rag');
const { getEnv } = require('../config/env');

/**
 * Production wiring: real LLM client, local embedder, Qdrant, and the
 * MongoDB checkpointer. Called once after the database connects.
 */
async function initWorkflowEngine() {
  const store = getVectorStore();
  await ensureCollections(store).catch(() => {
    // Qdrant may be starting; collections are also ensured lazily by the agents.
  });
  const graph = buildHiringGraph({
    deps: { llm: getLlmClient(), embedder: getEmbedder(), store },
    checkpointer: await createMongoCheckpointer(),
  });
  const runner = new WorkflowRunner({ graph, concurrency: getEnv().WORKFLOW_CONCURRENCY });
  setWorkflowRunner(runner);
  return runner;
}

module.exports = { initWorkflowEngine };
