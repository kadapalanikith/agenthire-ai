'use strict';

const path = require('node:path');
const { getEnv } = require('../config/env');
const { getSpec } = require('../utils/specLoader');
const { AgentError } = require('../workflows/errors');
const { logger } = require('../utils/logger');

const CACHE_DIR = path.resolve(__dirname, '../../.cache/models');
const BATCH_SIZE = 16;

/**
 * BAAI/bge-small-en-v1.5 embeddings computed locally with Transformers.js
 * (ONNX). bge uses CLS pooling with L2 normalisation; queries get the
 * retrieval instruction from the RAG spec, documents do not.
 */
function createLocalEmbedder({ modelId = getEnv().EMBEDDING_MODEL } = {}) {
  let extractorPromise;
  const spec = () => getSpec('evaluation/rag-retrieval');

  async function getExtractor() {
    if (!extractorPromise) {
      extractorPromise = (async () => {
        const { pipeline, env } = require('@huggingface/transformers');
        env.cacheDir = CACHE_DIR;
        const started = Date.now();
        const extractor = await pipeline('feature-extraction', modelId, { dtype: 'q8' });
        logger.info({ model: modelId, ms: Date.now() - started }, 'Embedding model loaded');
        return extractor;
      })().catch((err) => {
        extractorPromise = undefined;
        throw err;
      });
    }
    return extractorPromise;
  }

  async function embed(texts) {
    if (!texts.length) return [];
    const extractor = await getExtractor();
    const out = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const tensor = await extractor(texts.slice(i, i + BATCH_SIZE), { pooling: 'cls', normalize: true });
      out.push(...tensor.tolist());
    }
    const expected = spec().vector_size;
    if (out.some((v) => v.length !== expected)) {
      throw new AgentError('INVALID_SCHEMA', `Embedding size does not match vector_size ${expected} in the RAG spec`);
    }
    return out;
  }

  return {
    model: modelId,
    embedDocuments: (texts) => embed(texts),
    embedQuery: async (text) => (await embed([`${spec().query_instruction}${text}`]))[0],
    warmup: () => getExtractor().then(() => true),
  };
}

let embedder;
function getEmbedder() {
  if (!embedder) embedder = createLocalEmbedder();
  return embedder;
}

/** Test hook. */
function setEmbedder(e) {
  embedder = e;
}

module.exports = { createLocalEmbedder, getEmbedder, setEmbedder };
