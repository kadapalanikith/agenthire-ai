'use strict';

const { getEnv } = require('../config/env');
const { getSpec } = require('../utils/specLoader');
const { createQdrantStore } = require('./vectorStore.qdrant');

let store;

/** Process-wide vector store (Qdrant locally via Docker or Qdrant Cloud via QDRANT_URL). */
function getVectorStore() {
  if (!store) {
    const env = getEnv();
    store = createQdrantStore({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY });
  }
  return store;
}

/** Test hook: use the in-memory store. */
function setVectorStore(s) {
  store = s;
}

/** Collection settings from specs/evaluation/rag-retrieval.json. */
function collectionConfig(kind) {
  const spec = getSpec('evaluation/rag-retrieval');
  const indexedFields = kind === 'resumes' ? ['candidate_id', 'job_id'] : ['doc_type', 'doc_path'];
  return { name: spec.collections[kind], size: spec.vector_size, distance: spec.distance, indexedFields };
}

async function ensureCollections(vectorStore = getVectorStore()) {
  for (const kind of ['resumes', 'knowledge']) {
    const { name, ...cfg } = collectionConfig(kind);
    await vectorStore.ensureCollection(name, cfg);
  }
}

module.exports = { getVectorStore, setVectorStore, collectionConfig, ensureCollections };
