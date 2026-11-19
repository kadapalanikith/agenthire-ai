'use strict';

const { createLlmClient } = require('../../src/agents/shared/llmClient');

const DIM = 384;

/**
 * Deterministic test embedder: hashed bag-of-words, L2-normalised, 384 dims.
 * Identical texts score 1.0; unrelated texts score near 0. embedQuery does
 * not add the bge instruction so tests can target exact similarity.
 */
function createFakeEmbedder() {
  const vec = (text) => {
    const v = new Array(DIM).fill(0);
    for (const word of String(text).toLowerCase().match(/[a-z0-9.+#]+/g) || []) {
      let h = 2166136261;
      for (const ch of word) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
      v[h % DIM] += 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  };
  return {
    model: 'fake-embedder',
    calls: 0,
    async embedDocuments(texts) {
      this.calls += texts.length;
      return texts.map(vec);
    },
    async embedQuery(text) {
      return vec(text);
    },
  };
}

/**
 * LLM client backed by scripted providers. Each provider is
 * { name, respond: ({ system, user }) => string | throws }.
 */
function createFakeLlm(providers) {
  const calls = [];
  const client = createLlmClient({
    timeoutMs: 1000,
    providers: providers.map((p) => ({
      name: p.name,
      model: `${p.name}-model`,
      async complete(input) {
        calls.push({ provider: p.name, ...input });
        return p.respond(input);
      },
    })),
  });
  client.calls = calls;
  return client;
}

module.exports = { createFakeEmbedder, createFakeLlm };
